const unique = (arr) => [...new Set(arr)];

// "#Summer #sale, new_look" -> ['summer', 'sale', 'new_look']  (letters from any language are allowed)
exports.hashtags = (raw) =>
  unique(
    String(raw || '')
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#+/, '').toLowerCase())
      .filter((t) => /^[\p{L}\p{M}\p{N}_]{1,40}$/u.test(t))
  ).slice(0, 15);

// "red dress, summer sale" -> ['red dress', 'summer sale']
exports.keywords = (raw) =>
  unique(
    String(raw || '')
      .split(/[,\n]+/)
      .map((k) => k.trim().replace(/\s+/g, ' ').toLowerCase())
      .filter((k) => k.length >= 2 && k.length <= 40)
  ).slice(0, 20);

// "2026-11-05" -> Date at UTC midnight (same way due dates are stored). Anything else -> null.
exports.day = (raw) => {
  const s = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00.000Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
