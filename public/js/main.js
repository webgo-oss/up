(function () {
  var root = document.documentElement;

  // Role switch recolours the whole page and swaps role-specific fields
  document.querySelectorAll('input[name="role"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) root.setAttribute('data-role', radio.value);
    });
  });

  // Keep the chosen role when jumping between sign in and register
  document.querySelectorAll('a[data-keep-role]').forEach(function (link) {
    link.addEventListener('click', function () {
      var role = root.getAttribute('data-role');
      link.setAttribute('href', link.getAttribute('href').split('?')[0] + '?role=' + role);
    });
  });

  // Show / hide password
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-toggle'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  // Password strength meter (register page)
  var pw = document.getElementById('password');
  var meter = document.getElementById('meter');
  var text = document.getElementById('meter-text');
  if (pw && meter) {
    var labels = ['Use a mix of letters, numbers and symbols.', 'Weak. Add more characters.', 'Fair. Add a number or symbol.', 'Good.', 'Strong.'];
    pw.addEventListener('input', function () {
      var v = pw.value, score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) score++;
      if (!v) score = 0;
      meter.setAttribute('data-level', score);
      text.textContent = labels[score];
    });
  }


  // Live preview of the chosen image
  document.querySelectorAll('input[data-preview]').forEach(function (input) {
    input.addEventListener('change', function () {
      var img = document.getElementById(input.getAttribute('data-preview'));
      var file = input.files && input.files[0];
      if (!img) return;
      if (!file) { img.hidden = true; return; }
      img.src = URL.createObjectURL(file);
      img.hidden = false;
      var label = input.closest('.dropzone');
      if (label) label.querySelector('.drop-text strong').textContent = file.name;
    });
  });

  // Live chip preview for hashtag / keyword fields
  document.querySelectorAll('input[data-chips]').forEach(function (input) {
    var box = document.getElementById(input.getAttribute('data-chips'));
    var prefix = input.getAttribute('data-prefix') || '';
    var comma = input.getAttribute('data-split') === 'comma';
    function render() {
      var parts = input.value.split(comma ? /,/ : /[\s,]+/).map(function (t) {
        return t.trim().replace(/^#+/, '');
      }).filter(Boolean);
      box.textContent = '';
      parts.slice(0, comma ? 20 : 15).forEach(function (t) {
        var chip = document.createElement('span');
        chip.className = 'chip' + (comma ? ' chip-kw' : '');
        chip.textContent = prefix + t;
        box.appendChild(chip);
      });
    }
    input.addEventListener('input', render);
    render();
  });

  // Confirm before destructive actions
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
})();
