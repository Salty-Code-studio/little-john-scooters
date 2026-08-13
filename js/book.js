/* Little John Scooters · WhatsApp booking quiz (no backend).
   Collects the request step by step and hands the customer a premade
   WhatsApp message to Sjonny. The customer sends it themselves, so their
   number arrives automatically. Dates are picked on a tap-to-select
   calendar (styled after the homepage phone mockup); "long term" books by
   whole months instead. When FleetDesk goes live, config.js gets a
   BOOKING_URL and this page simply redirects to the real system. */
(function () {
  'use strict';

  var cfg = window.LJ_CONFIG || {};
  if (cfg.BOOKING_URL) { window.location.replace(cfg.BOOKING_URL); return; }

  var LANG = document.documentElement.lang === 'nl' ? 'nl' : 'en';

  var I18N = {
    en: {
      dows: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      days: function (n) { return n + (n === 1 ? ' day' : ' days'); },
      months: function (n) { return n + (n === 1 ? ' month' : ' months'); },
      est: 'Price to confirm by Little John. Helmet and insurance included.',
      hintStart: 'Tap your pick-up day.',
      hintEnd: 'Now tap your return day.',
      hintLong: 'Tap your start day, then choose the months below.',
      needDates: 'Tap a pick-up day and a return day on the calendar.',
      needStart: 'Tap your start day on the calendar.',
      needMonths: 'Choose how many months.',
      needPlace: 'Tell us where to bring it.',
      needName: 'We need a name for the booking.',
      shop: 'Pickup at the shop',
      delivery: 'Delivery',
      msg: function (s) {
        return [
          '🛵 BOOKING REQUEST',
          '• Scooters: ' + s.qty,
          '• From: ' + s.fromLabel + (s.time ? ', ' + s.time : ''),
          '• Until: ' + s.untilLabel + ' (' + s.durLabel + ')',
          s.estLabel ? '• Price est.: ' + s.estLabel + ' (to confirm)' : null,
          '• ' + (s.delivery ? 'Delivery: ' + s.place : 'Pickup: at the shop'),
          '• Name: ' + s.name,
          s.note ? '• Note: ' + s.note : null
        ].filter(Boolean).join('\n');
      }
    },
    nl: {
      dows: ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'],
      days: function (n) { return n + (n === 1 ? ' dag' : ' dagen'); },
      months: function (n) { return n + (n === 1 ? ' maand' : ' maanden'); },
      est: 'Prijs bevestigt Little John. Helm en verzekering inbegrepen.',
      hintStart: 'Tik je ophaaldag aan.',
      hintEnd: 'Tik nu je terugbrengdag aan.',
      hintLong: 'Tik je startdag aan en kies hieronder de maanden.',
      needDates: 'Tik een ophaaldag en een terugbrengdag aan op de kalender.',
      needStart: 'Tik je startdag aan op de kalender.',
      needMonths: 'Kies hoeveel maanden.',
      needPlace: 'Vertel ons waar we \'m mogen brengen.',
      needName: 'We hebben een naam nodig voor de boeking.',
      shop: 'Ophalen bij de shop',
      delivery: 'Bezorgen',
      msg: function (s) {
        return [
          '🛵 BOEKINGSAANVRAAG',
          '• Scooters: ' + s.qty,
          '• Van: ' + s.fromLabel + (s.time ? ', ' + s.time : ''),
          '• Tot: ' + s.untilLabel + ' (' + s.durLabel + ')',
          s.estLabel ? '• Richtprijs: ' + s.estLabel + ' (ter bevestiging)' : null,
          '• ' + (s.delivery ? 'Bezorgen: ' + s.place : 'Ophalen: bij de shop'),
          '• Naam: ' + s.name,
          s.note ? '• Opmerking: ' + s.note : null
        ].filter(Boolean).join('\n');
      }
    }
  }[LANG];

  var state = {
    qty: 1, mode: 'range', from: '', until: '', months: 0,
    time: '', delivery: false, place: '', name: '', note: ''
  };
  var steps = Array.prototype.slice.call(document.querySelectorAll('.q-step'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.quiz-progress i'));
  var current = 0;

  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.classList.toggle('active', k === current); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k <= current); });
    var err = steps[current].querySelector('.q-error');
    if (err) err.textContent = '';
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
  var MAX_AHEAD = 12; // months navigable ahead

  function addMonthsISO(iso, n) {
    var p = iso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, p[2]);
    // day overflow (e.g. 31 Jan + 1m) clamps to the last day of the target month
    if (d.getDate() !== p[2]) d = new Date(p[0], p[1] + n, 0);
    return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function fmt(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(LANG === 'nl' ? 'nl-NL' : 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function rentalDays() {
    if (!state.from || !state.until) return 0;
    return Math.max(0, Math.round((new Date(state.until) - new Date(state.from)) / 86400000));
  }
  function effectiveUntil() {
    if (state.mode === 'longterm') {
      return (state.from && state.months) ? addMonthsISO(state.from, state.months) : '';
    }
    return state.until;
  }

  /* ---------------- calendar ---------------- */
  var calEl = document.getElementById('qCal');
  function monthDelta() { return (view.y - now.getFullYear()) * 12 + (view.m - now.getMonth()); }

  function renderCal() {
    if (!calEl) return;
    var title = new Date(view.y, view.m, 1).toLocaleDateString(LANG === 'nl' ? 'nl-NL' : 'en-GB',
      { month: 'long', year: 'numeric' });
    var html = '<div class="cal2-head">' +
      '<button type="button" class="cal2-nav" data-cal="-1" aria-label="Previous month"' + (monthDelta() <= 0 ? ' disabled' : '') + '>‹</button>' +
      '<span class="cal2-title">' + title + '</span>' +
      '<button type="button" class="cal2-nav" data-cal="1" aria-label="Next month"' + (monthDelta() >= MAX_AHEAD ? ' disabled' : '') + '>›</button>' +
      '</div><div class="cal2-grid">';
    I18N.dows.forEach(function (d) { html += '<span class="dow">' + d + '</span>'; });

    var first = new Date(view.y, view.m, 1);
    var lead = (first.getDay() + 6) % 7; // Monday-first offset
    var daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    for (var i = 0; i < lead; i++) html += '<span></span>';

    var until = effectiveUntil();
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = isoOf(view.y, view.m, d);
      var cls = 'cal2-day';
      if (iso === state.from || (until && iso === until)) cls += ' edge';
      else if (state.from && until && iso > state.from && iso < until) cls += ' mid';
      var dis = iso < todayISO ? ' disabled' : '';
      html += '<button type="button" class="' + cls + '" data-day="' + iso + '"' + dis + '>' + d + '</button>';
    }
    html += '</div><p class="cal2-hint">' + hintText() + '</p>';
    calEl.innerHTML = html;
  }
  function hintText() {
    if (state.mode === 'longterm') return I18N.hintLong;
    if (!state.from) return I18N.hintStart;
    if (!state.until) return I18N.hintEnd;
    return fmt(state.from) + ' → ' + fmt(state.until);
  }

  if (calEl) calEl.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-cal]');
    if (nav) {
      var dir = parseInt(nav.dataset.cal, 10);
      var nm = new Date(view.y, view.m + dir, 1);
      view.y = nm.getFullYear(); view.m = nm.getMonth();
      renderCal(); return;
    }
    var day = e.target.closest('[data-day]');
    if (!day || day.disabled) return;
    clearErr();
    var iso = day.dataset.day;
    if (state.mode === 'longterm') {
      state.from = iso; // long term: the calendar only picks the start day
    } else if (!state.from || (state.from && state.until) || iso <= state.from) {
      state.from = iso; state.until = ''; // (re)start the range
    } else {
      state.until = iso;
    }
    renderCal(); refreshEstimate();
  });

  /* ---------------- mode toggle + months ---------------- */
  var monthsField = document.getElementById('qMonthsField');
  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.mode = b.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      if (monthsField) monthsField.hidden = state.mode !== 'longterm';
      if (state.mode === 'longterm') state.until = '';
      else state.months = 0;
      renderCal(); refreshEstimate();
    });
  });
  document.querySelectorAll('[data-months]').forEach(function (b) {
    b.addEventListener('click', function () {
      clearErr();
      state.months = parseInt(b.dataset.months, 10);
      document.querySelectorAll('[data-months]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      renderCal(); refreshEstimate();
    });
  });
  document.querySelectorAll('[data-time]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.time = b.dataset.time;
      document.querySelectorAll('[data-time]').forEach(function (x) { x.classList.toggle('sel', x === b); });
    });
  });

  /* ---------------- pricing ---------------- */
  function estimateCents(days) {
    if (days <= 0) return null;
    if (days === 1) return 3500;
    var best = Infinity;
    for (var m = 0; m <= Math.ceil(days / 28); m++) {
      var afterM = Math.max(0, days - m * 28);
      for (var w = 0; w <= Math.ceil(afterM / 7); w++) {
        var d = Math.max(0, afterM - w * 7);
        best = Math.min(best, m * 30000 + w * 14000 + d * 2250);
      }
    }
    return best;
  }
  function money(cents) { return '$' + (cents / 100).toFixed(2).replace(/\.00$/, ''); }
  function currentEstimate() {
    if (state.mode === 'longterm') {
      return state.months > 0 ? state.months * 30000 * state.qty : null;
    }
    var d = rentalDays();
    return d > 0 ? estimateCents(d) * state.qty : null;
  }
  function durLabel() {
    return state.mode === 'longterm' ? I18N.months(state.months) : I18N.days(rentalDays());
  }
  function refreshEstimate() {
    var box = document.getElementById('qEst');
    if (!box) return;
    var est = currentEstimate();
    if (!est) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<strong>± ' + money(est) + '</strong> · ' + durLabel() +
      (state.qty > 1 ? ' × ' + state.qty : '') + '<em>' + I18N.est + '</em>';
  }

  /* ---------------- summary + message ---------------- */
  function renderSummary() {
    var until = effectiveUntil();
    var est = currentEstimate();
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('rQty', String(state.qty));
    set('rFrom', state.from ? fmt(state.from) + (state.time ? ' · ' + state.time : '') : '');
    set('rUntil', until ? fmt(until) + ' · ' + durLabel() : '');
    set('rWhere', state.delivery ? I18N.delivery + ': ' + state.place : I18N.shop);
    set('rName', state.name + (state.note ? ' · ' + state.note : ''));
    var estRow = document.getElementById('rEstRow');
    if (estRow) estRow.style.display = est ? '' : 'none';
    set('rEst', est ? '± ' + money(est) : '');

    var msg = I18N.msg({
      qty: state.qty,
      fromLabel: state.from ? fmt(state.from) : '',
      time: state.time,
      untilLabel: until ? fmt(until) : '',
      durLabel: durLabel(),
      estLabel: est ? '± ' + money(est) : '',
      delivery: state.delivery,
      place: state.place,
      name: state.name,
      note: state.note
    });
    var wa = document.getElementById('qSend');
    if (wa) wa.href = 'https://wa.me/' + (cfg.WHATSAPP || '5997774734') + '?text=' + encodeURIComponent(msg);
  }

  /* ---------------- steps 1, 3, 4 ---------------- */
  document.querySelectorAll('[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.qty = parseInt(b.dataset.qty, 10);
      document.querySelectorAll('[data-qty]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      refreshEstimate();
      setTimeout(function () { show(1); }, 180);
    });
  });

  var placeField = document.getElementById('qPlaceField');
  document.querySelectorAll('[data-where]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.delivery = b.dataset.where === 'delivery';
      document.querySelectorAll('[data-where]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      if (placeField) placeField.hidden = !state.delivery;
      if (!state.delivery) setTimeout(function () { show(3); }, 180);
    });
  });
  var placeEl = document.getElementById('qPlace');
  if (placeEl) placeEl.addEventListener('input', function () { state.place = placeEl.value.trim(); clearErr(); });
  var nameEl = document.getElementById('qName');
  var noteEl = document.getElementById('qNote');
  if (nameEl) nameEl.addEventListener('input', function () { state.name = nameEl.value.trim(); clearErr(); });
  if (noteEl) noteEl.addEventListener('input', function () { state.note = noteEl.value.trim(); });

  /* ---------------- navigation + validation ---------------- */
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (current === 1) {
        if (state.mode === 'longterm') {
          if (!state.from) { fail(I18N.needStart); return; }
          if (!state.months) { fail(I18N.needMonths); return; }
        } else if (!state.from || !state.until || rentalDays() <= 0) { fail(I18N.needDates); return; }
      }
      if (current === 2 && state.delivery && !state.place) { fail(I18N.needPlace); return; }
      if (current === 3 && !state.name) { fail(I18N.needName); return; }
      show(current + 1);
    });
  });
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { show(current - 1); });
  });

  renderCal();
  show(0);
})();
