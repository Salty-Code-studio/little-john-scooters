/* Little John Scooters · Island Pop engine v4 (multi-page: home + tours, EN/NL) */
(function () {
  'use strict';

  /* ---- booking bridge ----
     BOOKING_URL lives in js/config.js. When the FleetDesk system goes live it
     points there and every .js-book CTA re-routes; while null, the CTAs go to
     the /book/ WhatsApp quiz (their href in the markup). */
  var BOOKING_URL = (window.LJ_CONFIG && window.LJ_CONFIG.BOOKING_URL) || null;

  if (BOOKING_URL) {
    document.querySelectorAll('.js-book').forEach(function (a) {
      a.href = BOOKING_URL;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.location.search.indexOf('static=1') !== -1;

  /* fleet model cards: click through to booking with the model preloaded.
     Works in static mode too, so it sits outside the animation guard. */
  function selectModel(card) {
    var title = document.getElementById('phoneModel');
    var stock = document.getElementById('phoneStock');
    if (title && card.dataset.model) title.textContent = card.dataset.model;
    if (stock && card.dataset.stock) stock.textContent = card.dataset.stock;
  }
  document.querySelectorAll('.model-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      selectModel(card);
      if (!e.target.closest('a')) {
        var booking = document.querySelector('#booking');
        if (booking) booking.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      }
    });
  });

  if (reduced || !window.gsap) {
    document.documentElement.classList.add('static');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);

  /* --- HERO: cartoon drops in with squash and stretch, then lives --- */
  var heroImg = document.querySelector('.hero-scooter');
  var heroStage = document.querySelector('.hero-stage');
  if (heroImg && heroStage) {
    gsap.set(heroImg, { y: -window.innerHeight, rotation: -14, transformOrigin: '50% 100%' });
    gsap.timeline({ delay: 0.25 })
      .to(heroImg, { y: 0, rotation: 0, duration: 1.0, ease: 'bounce.out' })
      .to(heroImg, { scaleY: 0.9, scaleX: 1.06, duration: 0.09, ease: 'power1.in' }, '-=0.14')
      .to(heroImg, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1.5, 0.4)' })
      .add(startIdle);
  }

  function startIdle() {
    gsap.to(heroStage, { y: -10, duration: 2.3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    /* wheelie hop every few seconds */
    gsap.timeline({ repeat: -1, repeatDelay: 4.2 })
      .to(heroImg, { rotation: -13, y: -18, duration: 0.28, ease: 'back.out(2)', transformOrigin: '16% 88%' })
      .to(heroImg, { rotation: 0, y: 0, duration: 0.7, ease: 'elastic.out(1.3, 0.38)' }, '+=0.25');
    /* exhaust puffs */
    gsap.timeline({ repeat: -1, repeatDelay: 2.4 })
      .fromTo('.hero-puffs i',
        { opacity: 0, scale: 0.3, x: 0, y: 0 },
        { opacity: 0.7, scale: 1, duration: 0.22, stagger: 0.11 })
      .to('.hero-puffs i',
        { opacity: 0, scale: 1.8, x: -46, y: -42, duration: 0.85, stagger: 0.11, ease: 'power1.out' }, '>-0.08');
  }

  /* giant hero words slide in from alternating sides */
  gsap.utils.toArray('.giant .line').forEach(function (line, i) {
    gsap.from(line, { x: i % 2 ? 90 : -90, opacity: 0, duration: 0.7, ease: 'back.out(1.8)', delay: 0.1 + i * 0.12 });
  });
  if (document.querySelector('#hero .hero-cta .btn')) {
    gsap.from('#hero .hero-cta .btn', { y: 40, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'back.out(2)', delay: 0.9 });
  }
  if (document.querySelector('.spin-badge')) {
    gsap.from('.spin-badge', { scale: 0, rotation: -60, duration: 0.7, ease: 'back.out(1.9)', delay: 1.1 });
  }

  /* doodles pop in and wiggle */
  document.querySelectorAll('.doodles').forEach(function (group) {
    var ds = group.querySelectorAll('.d');
    gsap.from(ds, {
      scale: 0, rotation: -40, duration: 0.6, stagger: 0.08, ease: 'back.out(2.4)',
      scrollTrigger: { trigger: group.parentElement, start: 'top 70%' }
    });
    ds.forEach(function (d, i) {
      gsap.to(d, { rotation: i % 2 ? 12 : -12, duration: 1.6 + i * 0.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  });

  /* velocity tilt on the living scooters */
  var lastY = window.scrollY;
  gsap.ticker.add(function () {
    var y = window.scrollY;
    var v = gsap.utils.clamp(-60, 60, y - lastY);
    lastY = y;
    gsap.to('.hero-scooter, .finale-scooter', { rotation: v * 0.18, duration: 0.4, overwrite: 'auto', ease: 'power1.out' });
  });

  /* --- fleet gag: rev, burnout smoke, wheelie, launch off screen, sneak back --- */
  var fleetScoot = document.querySelector('.fleet-scooter');
  var puffs = document.querySelectorAll('.smoke i');
  var gagPlaying = false;
  function burnoutWheelie() {
    if (gagPlaying || !fleetScoot) return;
    gagPlaying = true;
    var tl = gsap.timeline({ onComplete: function () { gagPlaying = false; } });
    tl.set(fleetScoot, { x: 0, rotation: 0, opacity: 1 })
      .to(fleetScoot, { x: '+=3', duration: 0.05, yoyo: true, repeat: 13, ease: 'none' })
      .fromTo(puffs,
        { opacity: 0, scale: 0.3, y: 0 },
        { opacity: 0.9, scale: 1.5, y: -26, duration: 0.5, stagger: 0.07, ease: 'power1.out' }, '<0.15')
      .to(puffs, { opacity: 0, scale: 2.2, y: -60, duration: 0.7, stagger: 0.05, ease: 'power1.out' }, '>-0.15')
      .to(fleetScoot, { rotation: -26, duration: 0.32, ease: 'back.out(2.2)', transformOrigin: '18% 88%' }, '-=0.9')
      .to(fleetScoot, { x: window.innerWidth * 1.25, duration: 0.95, ease: 'power2.in' }, '-=0.05')
      .to(fleetScoot, { rotation: -14, duration: 0.5, ease: 'power1.out' }, '<')
      .set(fleetScoot, { x: -1.5 * fleetScoot.offsetWidth, rotation: 0 }, '+=0.7')
      .to(fleetScoot, { x: 0, duration: 0.85, ease: 'power2.out' })
      .to(fleetScoot, { rotation: -2, duration: 0.2, ease: 'power1.out' })
      .to(fleetScoot, { rotation: 0, duration: 0.5, ease: 'elastic.out(1.3, 0.4)' });
  }
  if (fleetScoot && document.querySelector('#fleet')) {
    ScrollTrigger.create({
      trigger: '#fleet', start: 'top 60%',
      onEnter: burnoutWheelie,
      onEnterBack: burnoutWheelie
    });
  }

  /* --- section content: springy entrances (any page) --- */
  ['#fleet', '#rates', '#explore', '#tour', '#trust', '#intro', '#included', '#info'].forEach(function (sel) {
    var wrap = document.querySelector(sel + ' .wrap');
    if (!wrap) return;
    gsap.from(wrap.children, {
      y: 46, opacity: 0, duration: 0.75, stagger: 0.09, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: sel, start: 'top 66%' }
    });
  });
  /* tour route: cards pull in one by one */
  gsap.utils.toArray('.route-card').forEach(function (card, i) {
    gsap.from(card, {
      y: 60, opacity: 0, rotation: i % 2 ? 2 : -2, duration: 0.7, ease: 'back.out(1.7)',
      scrollTrigger: { trigger: card, start: 'top 82%' }
    });
  });
  if (document.querySelector('#booking')) {
    gsap.from('.booking-copy > *', {
      x: -60, opacity: 0, duration: 0.75, stagger: 0.08, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '#booking', start: 'top 62%' }
    });
    gsap.from('.phone', {
      x: 140, rotation: 14, opacity: 0, duration: 0.9, ease: 'back.out(1.4)',
      scrollTrigger: { trigger: '#booking', start: 'top 62%' }
    });
  }
  if (document.querySelector('#rates')) {
    gsap.from('.price-stack li', {
      x: -80, opacity: 0, duration: 0.7, stagger: 0.14, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: '#rates', start: 'top 60%' }
    });
  }

  /* --- REPAIRS: assembled cartoon morphs into its exploded twin on scroll --- */
  if (document.querySelector('#repairs')) {
    gsap.from('.repairs-copy > *', {
      x: -60, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '#repairs', start: 'top 66%' }
    });
    var morphTl = gsap.timeline({
      scrollTrigger: { trigger: '#repairs', start: 'top 70%', end: 'bottom 20%', scrub: 0.6 }
    });
    morphTl
      .to('.rp-whole', { opacity: 0, scale: 1.05, rotation: 2, duration: 1, ease: 'power1.inOut' }, 0)
      .fromTo('.rp-exploded', { opacity: 0, scale: 0.92, rotation: -2 },
        { opacity: 1, scale: 1, rotation: 0, duration: 1, ease: 'power1.inOut' }, 0)
      .to('.part-label', { opacity: 1, duration: 0.3, stagger: 0.07 }, 0.7)
      .to({}, { duration: 0.8 })
      .to('.part-label', { opacity: 0, duration: 0.25 }, 2.1)
      .to('.rp-exploded', { opacity: 0, scale: 0.94, duration: 1, ease: 'power1.inOut' }, 2.3)
      .to('.rp-whole', { opacity: 1, scale: 1, rotation: 0, duration: 1, ease: 'power1.inOut' }, 2.3);
  }

  /* --- finale: photo scooter skids in and settles --- */
  var fin = document.querySelector('.finale-scooter');
  if (fin) {
    gsap.set(fin, { x: -window.innerWidth * 0.7, rotation: -10 });
    ScrollTrigger.create({
      trigger: '#finale', start: 'top 55%', once: true,
      onEnter: function () {
        gsap.timeline()
          .to(fin, { x: 0, duration: 0.9, ease: 'power3.out' })
          .to(fin, { rotation: 6, duration: 0.16, ease: 'power2.out' }, '-=0.25')
          .to(fin, { rotation: 0, duration: 0.8, ease: 'elastic.out(1.2, 0.35)' })
          .add(function () {
            gsap.to(fin, { y: -10, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
          });
      }
    });
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
