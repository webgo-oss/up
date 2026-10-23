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
