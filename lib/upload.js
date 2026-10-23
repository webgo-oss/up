const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new Error('BAD_TYPE'))),
});

// Check the real file bytes, not just the type the browser claimed
function detectExt(file) {
  const fd = fs.openSync(file.path, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return '.png';
  if (b.slice(0, 4).toString() === 'GIF8') return '.gif';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return '.webp';
  return null;
}

function removeFile(name) {
  if (!name || !NAME_RE.test(name)) return;
  fs.unlink(path.join(UPLOAD_DIR, name), () => {});
}

// Middleware: never throws. On a bad upload it sets req.uploadError and the route decides what to show.
function single(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        req.uploadError =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'That image is too large. The limit is 5 MB.'
            : err.message === 'BAD_TYPE'
            ? 'Use a JPG, PNG, WebP or GIF image.'
            : 'The upload failed. Try again.';
      } else if (req.file && detectExt(req.file) !== path.extname(req.file.filename)) {
        removeFile(req.file.filename);
        req.file = null;
        req.uploadError = 'That file is not a valid image.';
      }
      next();
    });
  };
}

module.exports = { UPLOAD_DIR, NAME_RE, single, removeFile };
