/* Little John Scooters · WhatsApp booking quiz (no backend).
   Collects the request step by step and hands the customer a premade
   WhatsApp message to Sjonny. The customer sends it themselves, so their
   number arrives automatically. When FleetDesk goes live, config.js gets a
   BOOKING_URL and this page simply redirects to the real system. */
(function () {
  'use strict';

  var cfg = window.LJ_CONFIG || {};
  if (cfg.BOOKING_URL) { window.location.replace(cfg.BOOKING_URL); return; }

  var LANG = document.documentElement.lang === 'nl' ? 'nl' : 'en';

  var I18N = {
    en: {
      days: function (n) { return n + (n === 1 ? ' day' : ' days'); },
      est: 'Price to confirm by Little John. Helmet and insurance included.',
      needDates: 'Pick both dates first (return after pickup).',
      needPlace: 'Tell us where to bring it.',
      needName: 'We need a name for the booking.',
      shop: 'Pickup at the shop',
      delivery: 'Delivery',
      msg: function (s) {
        return [
          '🛵 BOOKING REQUEST',
          '• Scooters: ' + s.qty,
          '• From: ' + s.fromLabel + (s.time ? ', ' + s.time : ''),
          '• Until: ' + s.untilLabel + ' (' + s.daysLabel + ')',
          s.estLabel ? '• Price est.: ' + s.estLabel + ' (to confirm)' : null,
          '• ' + (s.delivery ? 'Delivery: ' + s.place : 'Pickup: at the shop'),
          '• Name: ' + s.name,
          s.note ? '• Note: ' + s.note : null
        ].filter(Boolean).join('\n');
      }
    },
    nl: {
      days: function (n) { return n + (n === 1 ? ' dag' : ' dagen'); },
      est: 'Prijs bevestigt Little John. Helm en verzekering inbegrepen.',
      needDates: 'Kies eerst beide datums (terugbrengen na ophalen).',
      needPlace: 'Vertel ons waar we \'m mogen brengen.',
      needName: 'We hebben een naam nodig voor de boeking.',
      shop: 'Ophalen bij de shop',
      delivery: 'Bezorgen',
      msg: function (s) {
        return [
          '🛵 BOEKINGSAANVRAAG',
          '• Scooters: ' + s.qty,
          '• Van: ' + s.fromLabel + (s.time ? ', ' + s.time : ''),
          '• Tot: ' + s.untilLabel + ' (' + s.daysLabel + ')',
          s.estLabel ? '• Richtprijs: ' + s.estLabel + ' (ter bevestiging)' : null,
          '• ' + (s.delivery ? 'Bezorgen: ' + s.place : 'Ophalen: bij de shop'),
          '• Naam: ' + s.name,
          s.note ? '• Opmerking: ' + s.note : null
        ].filter(Boolean).join('\n');
      }
    }
  }[LANG];

  var state = { qty: 1, from: '', time: '', until: '', delivery: false, place: '', name: '', note: '' };
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

  /* ---- pricing: best combination of month/week/day rates ---- */
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
  function rentalDays() {
    if (!state.from || !state.until) return 0;
    var ms = new Date(state.until) - new Date(state.from);
    return Math.max(0, Math.round(ms / 86400000));
  }
  function fmt(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(LANG === 'nl' ? 'nl-NL' : 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function refreshEstimate() {
    var box = document.getElementById('qEst');
    if (!box) return;
    var d = rentalDays();
    if (d <= 0) { box.hidden = true; return; }
    var est = estimateCents(d) * state.qty;
    box.hidden = false;
    box.innerHTML = '<strong>± ' + money(est) + '</strong> · ' + I18N.days(d) +
      (state.qty > 1 ? ' × ' + state.qty : '') + '<em>' + I18N.est + '</em>';
  }

  function renderSummary() {
    var d = rentalDays();
    var est = d > 0 ? estimateCents(d) * state.qty : null;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('rQty', String(state.qty));
    set('rFrom', state.from ? fmt(state.from) + (state.time ? ' · ' + state.time : '') : '');
    set('rUntil', state.until ? fmt(state.until) + ' · ' + I18N.days(d) : '');
    set('rWhere', state.delivery ? I18N.delivery + ': ' + state.place : I18N.shop);
    set('rName', state.name + (state.note ? ' · ' + state.note : ''));
    var estRow = document.getElementById('rEstRow');
    if (estRow) estRow.style.display = est ? '' : 'none';
    set('rEst', est ? '± ' + money(est) : '');

    var msg = I18N.msg({
      qty: state.qty,
      fromLabel: state.from ? fmt(state.from) : '',
      time: state.time,
      untilLabel: state.until ? fmt(state.until) : '',
      daysLabel: I18N.days(d),
      estLabel: est ? '± ' + money(est) : '',
      delivery: state.delivery,
      place: state.place,
      name: state.name,
      note: state.note
    });
    var wa = document.getElementById('qSend');
    if (wa) wa.href = 'https://wa.me/' + (cfg.WHATSAPP || '5997774734') + '?text=' + encodeURIComponent(msg);
  }

  /* ---- step 1: quantity ---- */
  document.querySelectorAll('[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.qty = parseInt(b.dataset.qty, 10);
      document.querySelectorAll('[data-qty]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      refreshEstimate();
      setTimeout(function () { show(1); }, 180);
    });
  });

  /* ---- step 2: dates ---- */
  var fromEl = document.getElementById('qFrom');
  var untilEl = document.getElementById('qUntil');
  var today = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var todayISO = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  if (fromEl) { fromEl.min = todayISO; fromEl.addEventListener('change', function () {
    state.from = fromEl.value;
    if (untilEl) { untilEl.min = state.from || todayISO; if (untilEl.value && untilEl.value <= state.from) { untilEl.value = ''; state.until = ''; } }
    refreshEstimate();
  }); }
  if (untilEl) { untilEl.min = todayISO; untilEl.addEventListener('change', function () {
    state.until = untilEl.value; refreshEstimate();
  }); }
  document.querySelectorAll('[data-time]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.time = b.dataset.time;
      document.querySelectorAll('[data-time]').forEach(function (x) { x.classList.toggle('sel', x === b); });
    });
  });

  /* ---- step 3: pickup or delivery ---- */
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
  if (placeEl) placeEl.addEventListener('input', function () { state.place = placeEl.value.trim(); });

  /* ---- step 4: name + note ---- */
  var nameEl = document.getElementById('qName');
  var noteEl = document.getElementById('qNote');
  if (nameEl) nameEl.addEventListener('input', function () { state.name = nameEl.value.trim(); });
  if (noteEl) noteEl.addEventListener('input', function () { state.note = noteEl.value.trim(); });

  /* ---- navigation with per-step validation ---- */
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (current === 1) {
        var d = rentalDays();
        if (!state.from || !state.until || d <= 0) { fail(I18N.needDates); return; }
      }
      if (current === 2 && state.delivery && !state.place) { fail(I18N.needPlace); return; }
      if (current === 3 && !state.name) { fail(I18N.needName); return; }
      show(current + 1);
    });
  });
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { show(current - 1); });
  });

  show(0);
})();
