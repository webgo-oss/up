const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { UPLOAD_DIR, NAME_RE } = require('../lib/upload');

const router = express.Router();

router.get('/:name', requireAuth, (req, res) => {
  if (!NAME_RE.test(req.params.name)) return res.sendStatus(404);
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(req.params.name, { root: UPLOAD_DIR }, (err) => {
    if (err && !res.headersSent) res.sendStatus(404);
  });
});

module.exports = router;
