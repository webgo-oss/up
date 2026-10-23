const User = require('../models/User');

const home = (role) => (role === 'admin' ? '/admin' : '/employee');

// Redirect signed-in users away from login/register
function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect(home(req.session.user.role));
  next();
}

// Load the user fresh from MongoDB so deactivated or deleted accounts lose access immediately
async function requireAuth(req, res, next) {
  try {
    if (!req.session.user) {
      req.session.flash = { type: 'info', text: 'Sign in to continue.' };
      return res.redirect('/login');
    }
    const user = await User.findById(req.session.user.id).lean();
    if (!user || !user.active) {
      return req.session.regenerate(() => {
        req.session.flash = { type: 'error', text: 'This account is no longer active.' };
        res.redirect('/login');
      });
    }
    req.user = user;
    res.locals.user = { id: user._id.toString(), name: user.name, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).render('error', {
        title: 'No access',
        code: 403,
        message: `This area is for ${role}s only.`,
      });
    }
    next();
  };
}

module.exports = { guestOnly, requireAuth, requireRole, home };
