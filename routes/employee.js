const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('employee'));

router.get('/', (req, res) => {
  res.render('employee/dashboard', { title: 'My workspace', me: req.user });
});

module.exports = router;
