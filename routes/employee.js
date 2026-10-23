const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { requireAuth, requireRole } = require('../middleware/auth');
const { single, removeFile } = require('../lib/upload');
const { hashtags, keywords } = require('../lib/parse');

const router = express.Router();
router.use(requireAuth, requireRole('employee'));

router.use(async (req, res, next) => {
  try {
    res.locals.redoCount = await Task.countDocuments({ assignee: req.user._id, status: 'redo' });
    next();
  } catch (err) {
    next(err);
  }
});

const notFound = (res) =>
  res.status(404).render('error', { title: 'Task not found', code: 404, message: "That task isn't available to you." });

// Available tasks: open and unclaimed
router.get('/', async (req, res, next) => {
  try {
    const [tasks, mineCount] = await Promise.all([
      Task.find({ status: 'open' }).sort({ createdAt: -1 }).lean(),
      Task.countDocuments({ assignee: req.user._id }),
    ]);
    res.render('employee/list', { title: 'Available tasks', nav: 'available', mode: 'available', tasks, mineCount, openCount: tasks.length });
  } catch (err) {
    next(err);
  }
});

// Tasks this employee has picked
router.get('/mine', async (req, res, next) => {
  try {
    const [tasks, openCount] = await Promise.all([
      Task.find({ assignee: req.user._id }).sort({ updatedAt: -1 }).lean(),
      Task.countDocuments({ status: 'open' }),
    ]);
    // Work that needs attention first
    const rank = { redo: 0, in_progress: 1, submitted: 2, rejected: 3, approved: 4 };
    tasks.sort((a, b) => rank[a.status] - rank[b.status]);
    res.render('employee/list', { title: 'My tasks', nav: 'mine', mode: 'mine', tasks, mineCount: tasks.length, openCount });
  } catch (err) {
    next(err);
  }
});

async function loadVisible(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res), null;
  const task = await Task.findById(req.params.id);
  const mine = task && task.assignee && task.assignee.equals(req.user._id);
  if (!task || (!mine && task.status !== 'open')) return notFound(res), null;
  return task;
}

router.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = await loadVisible(req, res);
    if (!task) return;
    const mine = !!(task.assignee && task.assignee.equals(req.user._id));
    res.render('employee/task', {
      title: task.title,
      nav: mine ? 'mine' : 'available',
      task,
      mine,
      canSubmit: mine && ['in_progress', 'redo'].includes(task.status),
      form: {},
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// Claim is atomic: only one employee can win an open task
router.post('/tasks/:id/claim', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, status: 'open', assignee: null },
      { $set: { assignee: req.user._id, status: 'in_progress', claimedAt: new Date() } },
      { new: true }
    );
    if (!task) {
      req.session.flash = { type: 'error', text: 'Someone else already picked that task.' };
      return res.redirect('/employee');
    }
    req.session.flash = { type: 'success', text: 'Task added to My tasks. Submit your work when it is ready.' };
    res.redirect('/employee/tasks/' + task._id);
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/release', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignee: req.user._id, status: 'in_progress' },
      { $set: { assignee: null, status: 'open' } }
    );
    req.session.flash = task
      ? { type: 'success', text: 'You gave the task back. It is open for others again.' }
      : { type: 'error', text: "You can't give this task back now." };
    res.redirect('/employee');
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/submit', single('image'), async (req, res, next) => {
  const cleanup = () => req.file && removeFile(req.file.filename);
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return cleanup(), notFound(res);
    const task = await Task.findOne({ _id: req.params.id, assignee: req.user._id, status: { $in: ['in_progress', 'redo'] } });
    if (!task) {
      cleanup();
      req.session.flash = { type: 'error', text: "This task isn't waiting for your work right now." };
      return res.redirect('/employee/mine');
    }

    const tags = hashtags(req.body.hashtags);
    const keys = keywords(req.body.keywords);
    const note = String(req.body.note || '').trim().slice(0, 500);
    const form = { hashtags: req.body.hashtags || '', keywords: req.body.keywords || '', note };
    const fail = (error) => {
      cleanup();
      res.status(400).render('employee/task', {
        title: task.title,
        nav: 'mine',
        task,
        mine: true,
        canSubmit: true,
        form,
        error,
      });
    };

    if (req.uploadError) return fail(req.uploadError);
    if (!req.file) return fail('Attach the image you made for this task.');
    if (!tags.length) return fail('Add at least one hashtag, like #summer.');
    if (!keys.length) return fail('Add at least one keyword, separated by commas.');

    const updated = await Task.findOneAndUpdate(
      { _id: task._id, assignee: req.user._id, status: { $in: ['in_progress', 'redo'] } },
      {
        $push: { submissions: { image: req.file.filename, hashtags: tags, keywords: keys, note } },
        $set: { status: 'submitted' },
      }
    );
    if (!updated) {
      cleanup();
      req.session.flash = { type: 'error', text: "This task isn't waiting for your work right now." };
      return res.redirect('/employee/mine');
    }
    req.session.flash = { type: 'success', text: 'Submitted. An admin will review it soon.' };
    res.redirect('/employee/tasks/' + task._id);
  } catch (err) {
    cleanup();
    next(err);
  }
});

module.exports = router;
