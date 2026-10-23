const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const { requireAuth, requireRole } = require('../middleware/auth');
const { single, removeFile } = require('../lib/upload');
const { STATUSES } = require('../lib/status');
const { parseRange, rangeFilter, buildEvents } = require('../lib/calendar');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// Number of submissions waiting on the admin, shown as a badge in the nav
router.use(async (req, res, next) => {
  try {
    res.locals.reviewCount = await Task.countDocuments({ status: 'submitted' });
    next();
  } catch (err) {
    next(err);
  }
});

const notFound = (res) =>
  res.status(404).render('error', { title: 'Task not found', code: 404, message: "That task doesn't exist any more." });

async function loadTask(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res), null;
  const task = await Task.findById(req.params.id).populate('assignee', 'name email');
  if (!task) return notFound(res), null;
  return task;
}

/* ---------------- Tasks ---------------- */

router.get('/', async (req, res, next) => {
  try {
    const filter = STATUSES.includes(req.query.status) ? req.query.status : 'all';
    const [grouped, tasks] = await Promise.all([
      Task.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Task.find(filter === 'all' ? {} : { status: filter })
        .sort({ updatedAt: -1 })
        .populate('assignee', 'name')
        .lean(),
    ]);
    const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n]));
    const total = grouped.reduce((sum, g) => sum + g.n, 0);
    res.render('admin/tasks', { title: 'Tasks', nav: 'tasks', tasks, counts, total, filter });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/new', (req, res) => {
  res.render('admin/task-new', { title: 'New task', nav: 'new', form: {}, error: null });
});

router.post('/tasks', single('image'), async (req, res, next) => {
  const title = String(req.body.title || '').trim();
  const brief = String(req.body.brief || '').trim();
  const due = req.body.dueDate ? new Date(req.body.dueDate) : null;
  const form = { title, brief, dueDate: req.body.dueDate || '' };
  const fail = (error) => {
    if (req.file) removeFile(req.file.filename);
    res.status(400).render('admin/task-new', { title: 'New task', nav: 'new', form, error });
  };
  try {
    if (req.uploadError) return fail(req.uploadError);
    if (title.length < 3 || title.length > 80) return fail('Give the task a title (3 to 80 characters).');
    if (brief.length > 1000) return fail('Keep the instructions under 1000 characters.');
    if (!req.file) return fail('Upload the task image employees should work from.');
    if (due && isNaN(due.getTime())) return fail('That due date is not valid.');

    const task = await Task.create({
      title,
      brief,
      image: req.file.filename,
      dueDate: due || undefined,
      createdBy: req.user._id,
    });
    req.session.flash = { type: 'success', text: 'Task published. Employees can now see it.' };
    res.redirect('/admin/tasks/' + task._id);
  } catch (err) {
    if (req.file) removeFile(req.file.filename);
    next(err);
  }
});

router.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (!task) return;
    res.render('admin/task', { title: task.title, nav: 'tasks', task });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/review', async (req, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (!task) return;
    const back = '/admin/tasks/' + task._id;
    const map = { approve: 'approved', redo: 'redo', reject: 'rejected' };
    const decision = map[req.body.decision];
    const comment = String(req.body.comment || '').trim().slice(0, 1000);

    if (task.status !== 'submitted' || !task.submissions.length) {
      req.session.flash = { type: 'error', text: 'There is nothing waiting for review on this task.' };
      return res.redirect(back);
    }
    if (!decision) return res.redirect(back);
    if (decision !== 'approved' && comment.length < 3) {
      req.session.flash = {
        type: 'error',
        text: decision === 'redo' ? 'Tell the employee what to change before asking for a redo.' : 'Add a reason before rejecting.',
      };
      return res.redirect(back);
    }

    const latest = task.submissions[task.submissions.length - 1];
    latest.review = { decision, comment, reviewedAt: new Date() };
    task.status = decision;
    await task.save();

    req.session.flash = {
      type: 'success',
      text: { approved: 'Approved.', redo: 'Sent back for a redo.', rejected: 'Rejected.' }[decision],
    };
    res.redirect(back);
  } catch (err) {
    next(err);
  }
});

// Put a stuck task back in the open pool so another employee can pick it up
router.post('/tasks/:id/reopen', async (req, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (!task) return;
    if (['in_progress', 'redo', 'rejected'].includes(task.status)) {
      task.assignee = null;
      task.status = 'open';
      await task.save();
      req.session.flash = { type: 'success', text: 'Task is open again for any employee.' };
    }
    res.redirect('/admin/tasks/' + task._id);
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/delete', async (req, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (!task) return;
    removeFile(task.image);
    task.submissions.forEach((s) => removeFile(s.image));
    await task.deleteOne();
    req.session.flash = { type: 'success', text: 'Task deleted.' };
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

/* ---------------- Calendar ---------------- */

router.get('/calendar', (req, res) => {
  res.render('calendar', {
    title: 'Calendar',
    nav: 'calendar',
    endpoint: '/admin/calendar/events',
    taskBase: '/admin/tasks',
    intro: 'Every task upload, pick-up, due date, submission and review in one place.',
  });
});

router.get('/calendar/events', async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });
    const tasks = await Task.find(rangeFilter(range)).populate('assignee', 'name').lean();
    res.set('Cache-Control', 'no-store');
    res.json(buildEvents(tasks, { ...range, showWho: true }));
  } catch (err) {
    next(err);
  }
});

/* ---------------- People ---------------- */

router.get('/people', async (req, res, next) => {
  try {
    const people = await User.find().sort({ createdAt: -1 }).lean();
    const stats = {
      total: people.length,
      admins: people.filter((p) => p.role === 'admin').length,
      employees: people.filter((p) => p.role === 'employee').length,
      inactive: people.filter((p) => !p.active).length,
    };
    res.render('admin/people', { title: 'People', nav: 'people', people, stats, me: req.user });
  } catch (err) {
    next(err);
  }
});

// Returns a valid target id, or null after redirecting (bad id, or an admin targeting themselves)
function targetId(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.redirect('/admin/people');
    return null;
  }
  if (id === req.user._id.toString()) {
    req.session.flash = { type: 'error', text: "You can't change your own account here." };
    res.redirect('/admin/people');
    return null;
  }
  return id;
}

router.post('/users/:id/toggle', async (req, res, next) => {
  try {
    const id = targetId(req, res);
    if (!id) return;
    const person = await User.findById(id);
    if (person) {
      person.active = !person.active;
      await person.save();
      req.session.flash = { type: 'success', text: `${person.name} is now ${person.active ? 'active' : 'deactivated'}.` };
    }
    res.redirect('/admin/people');
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/delete', async (req, res, next) => {
  try {
    const id = targetId(req, res);
    if (!id) return;
    const person = await User.findByIdAndDelete(id);
    if (person) {
      // Unfinished work goes back to the open pool
      await Task.updateMany(
        { assignee: id, status: { $in: ['in_progress', 'redo', 'submitted'] } },
        { $set: { assignee: null, status: 'open' } }
      );
      req.session.flash = { type: 'success', text: `${person.name} was removed. Their unfinished tasks are open again.` };
    }
    res.redirect('/admin/people');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
