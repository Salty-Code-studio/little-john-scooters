/* Little John Scooters · WhatsApp quiz engine (no backend).
   One engine, three quizzes, chosen by <body data-quiz="...">:
     rental  — one scooter per request; calendar range or long-term (monthly)
     tour    — Island Tour: people + date
     repair  — repairs & parts: issue, whose scooter, bring or pickup
   Every quiz ends in a premade WhatsApp message the customer sends
   themselves, so their number arrives automatically. When FleetDesk goes
   live, config.js gets a BOOKING_URL and the RENTAL quiz redirects there. */
(function () {
  'use strict';

  var cfg = window.LJ_CONFIG || {};
  var QUIZ = document.body.dataset.quiz || 'rental';
  if (QUIZ === 'rental' && cfg.BOOKING_URL) { window.location.replace(cfg.BOOKING_URL); return; }

  var LANG = document.documentElement.lang === 'nl' ? 'nl' : 'en';
  var NL = LANG === 'nl';

  var T = {
    dows: NL ? ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    days: function (n) { return n + (NL ? (n === 1 ? ' dag' : ' dagen') : (n === 1 ? ' day' : ' days')); },
    months: function (n) { return n + (NL ? (n === 1 ? ' maand' : ' maanden') : (n === 1 ? ' month' : ' months')); },
    people: function (n) { return n + (NL ? (n === 1 ? ' persoon' : ' personen') : (n === 1 ? ' person' : ' people')); },
    est: NL ? 'Prijs bevestigt Little John. Helm en verzekering inbegrepen.'
            : 'Price to confirm by Little John. Helmet and insurance included.',
    estTour: NL ? 'Prijs bevestigt Little John. Inclusief scooter, helm, water en $30 pp bij de Hangout Beachbar.'
                : 'Price to confirm by Little John. Includes scooter, helmet, water and $30 pp at the Hangout Beachbar.',
    hintStart: NL ? 'Tik je ophaaldag aan.' : 'Tap your pick-up day.',
    hintEnd: NL ? 'Tik nu je terugbrengdag aan.' : 'Now tap your return day.',
    hintLong: NL ? 'Tik je startdag aan. Kies daarna de maanden, of tik zelf je terugbrengdag aan.'
                 : 'Tap your start day. Then choose the months, or tap your own return day.',
    hintTour: NL ? 'Tik de dag aan waarop je de tour wil rijden.' : 'Tap the day you want to ride the tour.',
    needDates: NL ? 'Tik een ophaaldag en een terugbrengdag aan op de kalender.'
                  : 'Tap a pick-up day and a return day on the calendar.',
    needDay: NL ? 'Tik een dag aan op de kalender.' : 'Tap a day on the calendar.',
    needPlace: NL ? 'Vertel ons waar we \'m mogen ophalen.' : 'Tell us where to pick it up.',
    needDeliverPlace: NL ? 'Vertel ons waar we \'m mogen brengen.' : 'Tell us where to bring it.',
    needName: NL ? 'We hebben een naam nodig.' : 'We need a name.',
    needIssue: NL ? 'Kies wat er aan de hand is.' : 'Choose what is going on.',
    shop: NL ? 'Ophalen bij de shop' : 'Pickup at the shop',
    delivery: NL ? 'Bezorgen' : 'Delivery',
    bring: NL ? 'Ik breng \'m naar de shop' : 'I bring it to the shop',
    fetch: NL ? 'Ophalen bij mij' : 'Pick it up at my place',
    ownLJ: NL ? 'Een Little John scooter' : 'A Little John scooter',
    ownOwn: NL ? 'Mijn eigen scooter' : 'My own scooter'
  };

  var ISSUE_LABELS = {
    tires: NL ? 'Banden' : 'Tires',
    brakes: NL ? 'Remmen' : 'Brakes',
    start: NL ? 'Start niet' : 'Won\'t start',
    service: NL ? 'Onderhoudsbeurt' : 'Service & tune-up',
    parts: NL ? 'Onderdeel bestellen' : 'Order a part',
    other: NL ? 'Iets anders' : 'Something else'
  };

  var state = {
    from: '', until: '', mode: 'range', months: 0, time: '',
    where: 'shop', place: '', name: '', note: '',
    people: 0, daypart: '',
    issue: '', issueDetail: '', owner: 'lj', model: ''
  };
  /* repair steps are skippable: only lines the customer actually answered
     make it into the WhatsApp message */
  var touched = { where: false, owner: false };

  /* ---------------- steps engine ---------------- */
  var steps = Array.prototype.slice.call(document.querySelectorAll('.q-step'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.quiz-progress i'));
  var current = 0;

  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.classList.toggle('active', k === current); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k <= current); });
    clearErr();
    if (current === steps.length - 1) renderSummary();
  }
  function fail(msg) {
    var err = steps[current].querySelector('.q-error');
    if (err) err.textContent = msg;
  }
  function clearErr() {
    var err = steps[current] && steps[current].querySelector('.q-error');
    if (err) err.textContent = '';
  }

  /* ---------------- dates ---------------- */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function isoOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  var now = new Date();
  var todayISO = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  var view = { y: now.getFullYear(), m: now.getMonth() };
  var MAX_AHEAD = 12;

  function addMonthsISO(iso, n) {
    var p = iso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, p[2]);
    if (d.getDate() !== p[2]) d = new Date(p[0], p[1] + n, 0); // clamp overflow to month end
    return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
  }
  /* smallest whole number of months that covers from→until (partial rounds up) */
  function monthsBetween(from, until) {
    for (var n = 1; n <= 24; n++) if (addMonthsISO(from, n) >= until) return n;
    return 24;
  }
  function fmt(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(NL ? 'nl-NL' : 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function rentalDays() {
    if (!state.from || !state.until) return 0;
    return Math.max(0, Math.round((new Date(state.until) - new Date(state.from)) / 86400000));
  }

  /* ---------------- calendar: TWO months side by side ---------------- */
  var calEl = document.getElementById('qCal');
  var SINGLE_PICK = QUIZ === 'tour';
  function monthDelta() { return (view.y - now.getFullYear()) * 12 + (view.m - now.getMonth()); }

  function monthBlock(y, m) {
    var title = new Date(y, m, 1).toLocaleDateString(NL ? 'nl-NL' : 'en-GB', { month: 'long', year: 'numeric' });
    var html = '<div class="cal2-month"><p class="cal2-title">' + title + '</p><div class="cal2-grid">';
    T.dows.forEach(function (d) { html += '<span class="dow">' + d + '</span>'; });
    var lead = (new Date(y, m, 1).getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) html += '<span></span>';
    var dim = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= dim; d++) {
      var iso = isoOf(y, m, d);
      var cls = 'cal2-day';
      if (iso === state.from || (state.until && iso === state.until)) cls += ' edge';
      else if (state.from && state.until && iso > state.from && iso < state.until) cls += ' mid';
      var dis = iso < todayISO ? ' disabled' : '';
      html += '<button type="button" class="' + cls + '" data-day="' + iso + '"' + dis + '>' + d + '</button>';
    }
    return html + '</div></div>';
  }

  function renderCal() {
    if (!calEl) return;
    var next = new Date(view.y, view.m + 1, 1);
    calEl.innerHTML =
      '<div class="cal2-nav-row">' +
      '<button type="button" class="cal2-nav" data-cal="-1" aria-label="Previous month"' + (monthDelta() <= 0 ? ' disabled' : '') + '>‹</button>' +
      '<button type="button" class="cal2-nav" data-cal="1" aria-label="Next month"' + (monthDelta() >= MAX_AHEAD - 1 ? ' disabled' : '') + '>›</button>' +
      '</div>' +
      '<div class="cal2-months">' + monthBlock(view.y, view.m) + monthBlock(next.getFullYear(), next.getMonth()) + '</div>' +
      '<p class="cal2-hint">' + hintText() + '</p>';
  }

  function hintText() {
    if (SINGLE_PICK) return state.from ? fmt(state.from) : T.hintTour;
    if (state.mode === 'longterm') {
      if (!state.from) return T.hintLong;
      if (!state.until) return T.hintLong;
      return fmt(state.from) + ' → ' + fmt(state.until) + ' · ' + T.months(monthsBetween(state.from, state.until));
    }
    if (!state.from) return T.hintStart;
    if (!state.until) return T.hintEnd;
    return fmt(state.from) + ' → ' + fmt(state.until);
  }

  if (calEl) calEl.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-cal]');
    if (nav && !nav.disabled) {
      var nm = new Date(view.y, view.m + parseInt(nav.dataset.cal, 10), 1);
      view.y = nm.getFullYear(); view.m = nm.getMonth();
      renderCal(); return;
    }
    var day = e.target.closest('[data-day]');
    if (!day || day.disabled) return;
    clearErr();
    var iso = day.dataset.day;
    if (SINGLE_PICK) {
      state.from = iso; state.until = '';
    } else if (!state.from || (state.from && state.until && state.mode === 'range') || iso <= state.from) {
      state.from = iso; state.until = '';
      if (state.mode === 'longterm' && state.months) state.until = addMonthsISO(iso, state.months);
    } else {
      state.until = iso; // explicit return day, in BOTH modes
    }
    renderCal(); refreshEstimate();
  });

  /* ---------------- generic chip groups ---------------- */
  function bindGroup(attr, fn) {
    document.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.addEventListener('click', function () {
        clearErr();
        document.querySelectorAll('[' + attr + ']').forEach(function (x) { x.classList.toggle('sel', x === b); });
        fn(b.getAttribute(attr), b);
      });
    });
  }

  bindGroup('data-mode', function (v) {
    state.mode = v;
    var mf = document.getElementById('qMonthsField');
    if (mf) mf.hidden = v !== 'longterm';
    if (v === 'range') state.months = 0;
    renderCal(); refreshEstimate();
  });
  bindGroup('data-months', function (v) {
    state.months = parseInt(v, 10);
    if (state.from) state.until = addMonthsISO(state.from, state.months); // quick-fill, still adjustable on the calendar
    renderCal(); refreshEstimate();
  });
  bindGroup('data-time', function (v) { state.time = v; });
  bindGroup('data-daypart', function (v) { state.daypart = v; });
  bindGroup('data-people', function (v, b) {
    state.people = parseInt(v, 10);
    refreshEstimate();
    setTimeout(function () { show(current + 1); }, 180);
  });
  bindGroup('data-where', function (v) {
    state.where = v; touched.where = true;
    var pf = document.getElementById('qPlaceField');
    if (pf) pf.hidden = (v === 'shop' || v === 'bring');
    if (v === 'shop' || v === 'bring') setTimeout(function () { show(current + 1); }, 180);
  });
  bindGroup('data-issue', function (v) {
    state.issue = v;
    var df = document.getElementById('qIssueDetailField');
    if (df) df.hidden = false; // detail always useful once an issue is picked
  });
  bindGroup('data-owner', function (v) {
    state.owner = v; touched.owner = true;
    var mf = document.getElementById('qModelField');
    if (mf) mf.hidden = v !== 'own';
  });

  /* repairs deep-link: /repairs/?type=parts preselects the parts issue */
  if (QUIZ === 'repair') {
    var pre = new URLSearchParams(window.location.search).get('type');
    if (pre === 'parts') {
      var pb = document.querySelector('[data-issue="parts"]');
      if (pb) pb.click();
    }
  }

  /* ---------------- text inputs ---------------- */
  function bindInput(id, key) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { state[key] = el.value.trim(); clearErr(); });
  }
  bindInput('qPlace', 'place');
  bindInput('qName', 'name');
  bindInput('qNote', 'note');
  bindInput('qModel', 'model');
  bindInput('qIssueDetail', 'issueDetail');

  /* ---------------- pricing ---------------- */
  function money(cents) { return '$' + (cents / 100).toFixed(2).replace(/\.00$/, ''); }
  function monthsCost(m) { if (m <= 0) return 0; return m === 1 ? 35000 : m * 30000; }
  function rangeEstimate(days) {
    if (days <= 0) return null;
    if (days === 1) return 3500;
    var best = Infinity;
    for (var m = 0; m <= Math.ceil(days / 28); m++) {
      var afterM = Math.max(0, days - m * 28);
      for (var w = 0; w <= Math.ceil(afterM / 7); w++) {
        var d = Math.max(0, afterM - w * 7);
        best = Math.min(best, monthsCost(m) + w * 15000 + d * 2250);
      }
    }
    return best;
  }
  function currentEstimate() {
    if (QUIZ === 'tour') return state.people > 0 ? state.people * 14500 : null;
    if (QUIZ !== 'rental') return null;
    if (!state.from || !state.until) return null;
    if (state.mode === 'longterm') return monthsCost(monthsBetween(state.from, state.until));
    return rangeEstimate(rentalDays());
  }
  function durLabel() {
    if (state.mode === 'longterm' && state.from && state.until) return T.months(monthsBetween(state.from, state.until));
    return T.days(rentalDays());
  }
  function refreshEstimate() {
    var box = document.getElementById('qEst');
    if (!box) return;
    var est = currentEstimate();
    if (!est) { box.hidden = true; return; }
    box.hidden = false;
    if (QUIZ === 'tour') {
      box.innerHTML = '<strong>± ' + money(est) + '</strong> · ' + T.people(state.people) + ' × $145<em>' + T.estTour + '</em>';
    } else {
      box.innerHTML = '<strong>± ' + money(est) + '</strong> · ' + durLabel() + '<em>' + T.est + '</em>';
    }
  }

  /* ---------------- summary + WhatsApp message ---------------- */
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  /* like set(), but hides the whole recap row when the value is empty */
  function setRow(id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = v;
    var li = el.closest('li');
    if (li) li.style.display = v ? '' : 'none';
  }
  function whereLabel() {
    if (QUIZ === 'repair') return state.where === 'bring' ? T.bring : T.fetch + ': ' + state.place;
    return state.where === 'delivery' ? T.delivery + ': ' + state.place : T.shop;
  }

  function renderSummary() {
    var est = currentEstimate();
    var estRow = document.getElementById('rEstRow');
    if (estRow) estRow.style.display = est ? '' : 'none';
    set('rEst', est ? '± ' + money(est) : '');
    set('rName', state.name + (state.note ? ' · ' + state.note : ''));

    var lines = [];
    if (QUIZ === 'rental') {
      set('rFrom', state.from ? fmt(state.from) + (state.time ? ' · ' + state.time : '') : '');
      set('rUntil', state.until ? fmt(state.until) + ' · ' + durLabel() : '');
      set('rWhere', whereLabel());
      lines = [
        NL ? '🛵 BOEKINGSAANVRAAG' : '🛵 BOOKING REQUEST',
        '• Scooter: Myst 50cc',
        '• ' + (NL ? 'Van' : 'From') + ': ' + fmt(state.from) + (state.time ? ', ' + state.time : ''),
        '• ' + (NL ? 'Tot' : 'Until') + ': ' + fmt(state.until) + ' (' + durLabel() + ')',
        est ? '• ' + (NL ? 'Richtprijs' : 'Price est.') + ': ± ' + money(est) + (NL ? ' (ter bevestiging)' : ' (to confirm)') : null,
        '• ' + whereLabel(),
        '• ' + (NL ? 'Naam' : 'Name') + ': ' + state.name,
        state.note ? '• ' + (NL ? 'Opmerking' : 'Note') + ': ' + state.note : null
      ];
    } else if (QUIZ === 'tour') {
      set('rPeople', T.people(state.people));
      set('rDate', state.from ? fmt(state.from) + (state.daypart ? ' · ' + state.daypart : '') : '');
      lines = [
        NL ? '🌴 TOUR-AANVRAAG' : '🌴 TOUR REQUEST',
        '• Island Tour with Little John',
        '• ' + (NL ? 'Personen' : 'People') + ': ' + state.people,
        '• ' + (NL ? 'Datum' : 'Date') + ': ' + fmt(state.from) + (state.daypart ? ' (' + state.daypart + ')' : ''),
        est ? '• ' + (NL ? 'Richtprijs' : 'Price est.') + ': ± ' + money(est) + (NL ? ' (ter bevestiging)' : ' (to confirm)') : null,
        '• ' + (NL ? 'Naam' : 'Name') + ': ' + state.name,
        state.note ? '• ' + (NL ? 'Opmerking' : 'Note') + ': ' + state.note : null
      ];
    } else {
      /* repair: every step can be skipped, so only answered lines are sent */
      var issue = state.issue ? (ISSUE_LABELS[state.issue] || state.issue) + (state.issueDetail ? ' · ' + state.issueDetail : '') : (state.issueDetail || '');
      var scooter = touched.owner ? (state.owner === 'own' ? T.ownOwn + (state.model ? ' · ' + state.model : '') : T.ownLJ) : '';
      setRow('rIssue', issue);
      setRow('rScooter', scooter);
      setRow('rWhere', touched.where ? whereLabel() : '');
      setRow('rName', state.name + (state.note ? ' · ' + state.note : ''));
      lines = [
        state.issue === 'parts' ? (NL ? '🔧 ONDERDEEL-AANVRAAG' : '🔧 PARTS REQUEST') : (NL ? '🔧 REPARATIE-AANVRAAG' : '🔧 REPAIR REQUEST'),
        issue ? '• ' + (NL ? 'Wat' : 'What') + ': ' + issue : null,
        scooter ? '• Scooter: ' + scooter : null,
        touched.where ? '• ' + whereLabel() : null,
        state.name ? '• ' + (NL ? 'Naam' : 'Name') + ': ' + state.name : null,
        state.note ? '• ' + (NL ? 'Opmerking' : 'Note') + ': ' + state.note : null
      ];
    }
    var wa = document.getElementById('qSend');
    if (wa) wa.href = 'https://wa.me/' + (cfg.WHATSAPP || '5997774734') + '?text=' + encodeURIComponent(lines.filter(Boolean).join('\n'));
  }

  /* ---------------- navigation + per-step validation ---------------- */
  var VALIDATORS = {
    dates: function () {
      if (!state.from || !state.until || rentalDays() <= 0) return T.needDates;
      return '';
    },
    day: function () { return state.from ? '' : T.needDay; },
    where: function () {
      if (QUIZ === 'repair') return state.where === 'fetch' && !state.place ? T.needPlace : '';
      return state.where === 'delivery' && !state.place ? T.needDeliverPlace : '';
    },
    issue: function () { return state.issue ? '' : T.needIssue; },
    name: function () { return state.name ? '' : T.needName; },
    none: function () { return ''; }
  };
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = VALIDATORS[steps[current].dataset.validate || 'none'];
      var msg = v ? v() : '';
      if (msg) { fail(msg); return; }
      show(current + 1);
    });
  });
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { show(current - 1); });
  });
  /* skip: advance without validating, leaving the step unanswered */
  document.querySelectorAll('[data-skip]').forEach(function (b) {
    b.addEventListener('click', function () { show(current + 1); });
  });

  renderCal();
  refreshEstimate();
  show(0);
})();
