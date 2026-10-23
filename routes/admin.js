const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const people = await User.find().sort({ createdAt: -1 }).lean();
    const stats = {
      total: people.length,
      admins: people.filter((p) => p.role === 'admin').length,
      employees: people.filter((p) => p.role === 'employee').length,
      inactive: people.filter((p) => !p.active).length,
    };
    res.render('admin/dashboard', { title: 'Admin', people, stats, me: req.user });
  } catch (err) {
    next(err);
  }
});

// Returns a valid target id, or null after redirecting (bad id, or the admin targeting themselves)
function targetId(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.redirect('/admin');
    return null;
  }
  if (id === req.user._id.toString()) {
    req.session.flash = { type: 'error', text: "You can't change your own account here." };
    res.redirect('/admin');
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
      req.session.flash = {
        type: 'success',
        text: `${person.name} is now ${person.active ? 'active' : 'deactivated'}.`,
      };
    }
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/delete', async (req, res, next) => {
  try {
    const id = targetId(req, res);
    if (!id) return;
    const person = await User.findByIdAndDelete(id);
    if (person) req.session.flash = { type: 'success', text: `${person.name} was removed.` };
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
