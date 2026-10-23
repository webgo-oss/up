const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { guestOnly, home } = require('../middleware/auth');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('error', {
      title: 'Too many attempts',
      code: 429,
      message: 'Too many attempts from this device. Wait 15 minutes and try again.',
    }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const codeMatches = (input) => crypto.timingSafeEqual(sha(input), sha(process.env.ADMIN_INVITE_CODE));

// Replace the session on sign-in to prevent session fixation
function startSession(req, user, done) {
  req.session.regenerate((err) => {
    if (err) return done(err);
    req.session.user = { id: user._id.toString(), name: user.name, role: user.role };
    done();
  });
}

router.get('/', (req, res) => {
  res.redirect(req.session.user ? home(req.session.user.role) : '/login');
});

router.get('/login', guestOnly, (req, res) => {
  const role = req.query.role === 'admin' ? 'admin' : 'employee';
  res.render('login', { title: 'Sign in', role, form: {}, error: null });
});

router.post('/login', guestOnly, limiter, async (req, res, next) => {
  try {
    const role = req.body.role === 'admin' ? 'admin' : 'employee';
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const fail = (error) => res.status(401).render('login', { title: 'Sign in', role, form: { email }, error });

    const user = await User.findOne({ email }).select('+password');
    // Always run bcrypt so response time doesn't reveal whether the email exists
    const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !ok) return fail('Email or password is incorrect.');
    if (!user.active) return fail('This account has been deactivated. Ask an admin to restore it.');
    if (user.role !== role) {
      return fail(
        user.role === 'admin'
          ? 'This is an admin account. Switch to Admin above to sign in.'
          : 'This is an employee account. Switch to Employee above to sign in.'
      );
    }

    user.lastLogin = new Date();
    await user.save();
    startSession(req, user, (err) => {
      if (err) return next(err);
      res.redirect(home(user.role));
    });
  } catch (err) {
    next(err);
  }
});

router.get('/register', guestOnly, (req, res) => {
  const role = req.query.role === 'admin' ? 'admin' : 'employee';
  res.render('register', { title: 'Create account', role, form: {}, error: null });
});

router.post('/register', guestOnly, limiter, async (req, res, next) => {
  const role = req.body.role === 'admin' ? 'admin' : 'employee';
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').toLowerCase().trim();
  const department = String(req.body.department || '').trim().slice(0, 60);
  const form = { name, email, department };
  const fail = (error) => res.status(400).render('register', { title: 'Create account', role, form, error });

  try {
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm || '');
    const adminCode = String(req.body.adminCode || '');

    if (name.length < 2 || name.length > 60) return fail('Enter your full name (2 to 60 characters).');
    if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return fail('Use a password with at least 8 characters, including a letter and a number.');
    }
    if (password !== confirm) return fail("Passwords don't match.");
    if (role === 'admin' && !codeMatches(adminCode)) {
      return fail('That admin invite code is not valid.');
    }

    const user = await User.create({
      name,
      email,
      role,
      department: role === 'employee' ? department : '',
      password: await bcrypt.hash(password, 12),
    });

    startSession(req, user, (err) => {
      if (err) return next(err);
      req.session.flash = { type: 'success', text: `Welcome, ${user.name.split(' ')[0]}. Your account is ready.` };
      res.redirect(home(user.role));
    });
  } catch (err) {
    if (err.code === 11000) {
      return fail('An account with this email already exists. Try signing in instead.');
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('crewdesk.sid');
    res.redirect('/login');
  });
});

module.exports = router;
