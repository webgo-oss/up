(function () {
  var root = document.getElementById('cal');
  if (!root) return;

  var endpoint = root.getAttribute('data-endpoint');
  var taskBase = root.getAttribute('data-task-base');

  var TYPES = [
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'due', label: 'Due' },
    { key: 'picked', label: 'Picked up' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved', label: 'Approved' },
    { key: 'redo', label: 'Redo asked' },
    { key: 'rejected', label: 'Rejected' },
  ];
  var LABEL = {};
  TYPES.forEach(function (t) { LABEL[t.key] = t.label; });
  var OPEN_STATES = ['open', 'in_progress', 'redo'];

  var $ = function (id) { return document.getElementById(id); };
  var gridEl = $('cal-grid'), titleEl = $('cal-title'), errEl = $('cal-error');
  var dayTitleEl = $('cal-day-title'), dayListEl = $('cal-day-list'), legendEl = $('cal-legend');

  var monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  var dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  var now = new Date();
  var state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    byDay: {},
    hidden: {},
    selected: null,
    req: 0,
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function keyOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function localKey(d) { return keyOf(d.getFullYear(), d.getMonth(), d.getDate()); }
  var todayKey = localKey(now);

  // Due dates are whole days stored as UTC midnight, so read them in UTC. Everything else is a real moment: local time.
  function eventKey(ev) {
    var d = new Date(ev.at);
    return ev.allDay ? keyOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : localKey(d);
  }

  function isOverdue(ev, key) {
    return ev.type === 'due' && OPEN_STATES.indexOf(ev.status) !== -1 && key < todayKey;
  }

  function gridStart() {
    var first = new Date(state.year, state.month, 1);
    var offset = (first.getDay() + 6) % 7; // week starts on Monday
    return new Date(state.year, state.month, 1 - offset);
  }

  function dot(type, overdue) {
    var s = document.createElement('span');
    s.className = 'cal-dot t-' + (overdue ? 'overdue' : type);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function label(ev, key) {
    return isOverdue(ev, key) ? 'Overdue' : LABEL[ev.type];
  }

  function buildLegend() {
    TYPES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal-key';
      b.setAttribute('aria-pressed', 'true');
      b.appendChild(dot(t.key, false));
      b.appendChild(document.createTextNode(t.label));
      b.addEventListener('click', function () {
        state.hidden[t.key] = !state.hidden[t.key];
        b.setAttribute('aria-pressed', state.hidden[t.key] ? 'false' : 'true');
        render();
      });
      legendEl.appendChild(b);
    });
  }

  function visible(list) {
    return (list || []).filter(function (e) { return !state.hidden[e.type]; });
  }

  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return new Date(a.at) - new Date(b.at);
    });
  }

  function render() {
    titleEl.textContent = monthFmt.format(new Date(state.year, state.month, 1));
    gridEl.textContent = '';
    var start = gridStart();

    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = localKey(d);
      var events = sortEvents(visible(state.byDay[key]));
      var inMonth = d.getMonth() === state.month;

      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day' + (inMonth ? '' : ' out') + (key === todayKey ? ' today' : '') + (key === state.selected ? ' selected' : '');
      cell.setAttribute('data-key', key);
      cell.setAttribute('aria-label', dayFmt.format(d) + ', ' + events.length + (events.length === 1 ? ' event' : ' events'));
      cell.setAttribute('aria-pressed', key === state.selected ? 'true' : 'false');

      var num = document.createElement('span');
      num.className = 'cal-num';
      num.textContent = d.getDate();
      cell.appendChild(num);

      var list = document.createElement('span');
      list.className = 'cal-events';
      events.slice(0, 3).forEach(function (ev) {
        var chip = document.createElement('span');
        chip.className = 'cal-chip t-' + (isOverdue(ev, key) ? 'overdue' : ev.type);
        var txt = document.createElement('span');
        txt.className = 'cal-chip-text';
        txt.textContent = label(ev, key) + ': ' + ev.title;
        chip.appendChild(txt);
        list.appendChild(chip);
      });
      if (events.length > 3) {
        var more = document.createElement('span');
        more.className = 'cal-more';
        more.textContent = '+' + (events.length - 3) + ' more';
        list.appendChild(more);
      }
      cell.appendChild(list);

      cell.addEventListener('click', onPick);
      gridEl.appendChild(cell);
    }
    renderDay();
  }

  function onPick(e) {
    state.selected = e.currentTarget.getAttribute('data-key');
    render();
  }

  function renderDay() {
    dayListEl.textContent = '';
    if (!state.selected) {
      dayTitleEl.textContent = 'Pick a day';
      return;
    }
    var p = state.selected.split('-');
    dayTitleEl.textContent = dayFmt.format(new Date(+p[0], +p[1] - 1, +p[2]));
    var events = sortEvents(visible(state.byDay[state.selected]));

    if (!events.length) {
      var none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'Nothing on this day.';
      dayListEl.appendChild(none);
      return;
    }

    var ul = document.createElement('ul');
    ul.className = 'cal-list';
    events.forEach(function (ev) {
      var li = document.createElement('li');
      li.className = 't-' + (isOverdue(ev, state.selected) ? 'overdue' : ev.type);
      li.appendChild(dot(ev.type, isOverdue(ev, state.selected)));

      var body = document.createElement('div');
      var what = document.createElement('span');
      what.className = 'cal-what';
      what.textContent = label(ev, state.selected);
      body.appendChild(what);

      var a = document.createElement('a');
      a.href = taskBase + '/' + encodeURIComponent(ev.taskId);
      a.textContent = ev.title;
      body.appendChild(a);

      var meta = [];
      if (!ev.allDay) meta.push(timeFmt.format(new Date(ev.at)));
      if (ev.who) meta.push(ev.who);
      if (meta.length) {
        var m = document.createElement('small');
        m.textContent = meta.join(' \u00b7 ');
        body.appendChild(m);
      }
      li.appendChild(body);
      ul.appendChild(li);
    });
    dayListEl.appendChild(ul);
  }

  function load() {
    var start = gridStart();
    // A day of padding on each side covers timezone edges
    var from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    var to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 43);
    var mine = ++state.req;
    errEl.hidden = true;

    fetch(endpoint + '?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString()), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        var ok = r.ok && (r.headers.get('content-type') || '').indexOf('application/json') !== -1;
        if (!ok) throw new Error('bad response');
        return r.json();
      })
      .then(function (events) {
        if (mine !== state.req) return; // a newer month was requested meanwhile
        state.byDay = {};
        events.forEach(function (ev) {
          var k = eventKey(ev);
          (state.byDay[k] = state.byDay[k] || []).push(ev);
        });
        render();
      })
      .catch(function () {
        if (mine !== state.req) return;
        errEl.textContent = 'Could not load the calendar. Refresh the page, and sign in again if asked.';
        errEl.hidden = false;
      });
  }

  function go(delta) {
    var d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    state.selected = null;
    state.byDay = {};
    render();
    load();
  }

  $('cal-prev').addEventListener('click', function () { go(-1); });
  $('cal-next').addEventListener('click', function () { go(1); });
  $('cal-today').addEventListener('click', function () {
    var t = new Date();
    state.year = t.getFullYear();
    state.month = t.getMonth();
    state.selected = localKey(t);
    state.byDay = {};
    render();
    load();
  });

  buildLegend();
  state.selected = todayKey;
  render();
  load();
})();
