require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crewdesk';
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET || !process.env.ADMIN_INVITE_CODE) {
  console.error('Missing SESSION_SECRET or ADMIN_INVITE_CODE. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const app = express();
if (isProd) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

const { STATUS_LABEL } = require('./lib/status');
app.locals.statusLabel = (s) => STATUS_LABEL[s] || s;
app.locals.fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
app.locals.fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'crewdesk.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Per-request locals: current user, flash message, CSRF token
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// CSRF check for every state-changing request
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  // Multipart forms (file uploads) pass the token in the query string because the body is parsed later
  const sent = Buffer.from(String((req.body && req.body._csrf) || req.query._csrf || ''));
  const real = Buffer.from(req.session.csrf);
  if (sent.length !== real.length || !crypto.timingSafeEqual(sent, real)) {
    return res.status(403).render('error', {
      title: 'Session expired',
      code: 403,
      message: 'Your form expired. Go back, refresh the page and try again.',
    });
  }
  next();
});

app.use('/', require('./routes/auth'));
app.use('/files', require('./routes/files'));
app.use('/admin', require('./routes/admin'));
app.use('/employee', require('./routes/employee'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    code: 404,
    message: "We couldn't find that page.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    code: 500,
    message: 'Something broke on our side. Try again in a moment.',
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Crewdesk running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
