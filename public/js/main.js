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

  // Confirm before destructive actions
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
})();
