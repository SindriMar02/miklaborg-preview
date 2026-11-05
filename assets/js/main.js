/* Miklaborg on the Stellar design: motion + interaction. Every number is a literal from the Stellar teardown unless
   marked "authored" (see _docs/miklaborg-2026-11-04/MOTION.md). Two layers:
   initUI()      once per page: menu, modals, lightbox, forms, accordions, filters, rail drag (functional, instant under reduced motion)
   buildMotion() inside a gsap.context: scroll choreography, rebuilt on width change and reverted cleanly. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, body = d.body;
  var q = function (s, c) { return (c || d).querySelector(s); };
  var qa = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var page = root.dataset.page;
  var reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = matchMedia('(hover:hover) and (pointer:fine)');
  var R = function () { return reduceMQ.matches; };
  var ready = function () { root.classList.add('mk-ready'); };
  setTimeout(ready, 3500); // failsafe: never leave content hidden if enhancement fails

  if (!window.gsap || !window.ScrollTrigger || !window.SplitText || !window.CustomEase) { ready(); initBasicUI(); return; }
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('myEase', '0.28,0.11,0.32,1');
  gsap.config({ nullTargetWarn: false });
  if (R()) root.classList.add('reduced');
  reduceMQ.addEventListener('change', function () { location.reload(); });

  /* ---------------------------------------------------------------- scroll lock + Lenis (fine pointers only, phones native) */
  var lenis = null, locks = 0;
  function initLenis() {
    if (R() || !fineMQ.matches || !window.Lenis) return;
    // RYXjuJOv.js:31411, gestureOrientation written as the valid "vertical" (the shipped capital V is not a Lenis value)
    lenis = new Lenis({ lerp: 1, duration: 1.2, wheelMultiplier: 0.6, infinite: false, orientation: 'vertical', gestureOrientation: 'vertical', syncTouch: false, allowNestedScroll: true, autoRaf: true });
  }
  function lock() { if (locks++ === 0) { if (lenis) lenis.stop(); var sb = innerWidth - root.clientWidth; if (sb > 0) body.style.paddingRight = sb + 'px'; body.classList.add('scroll-locked'); } }
  function unlock() { if (--locks <= 0) { locks = 0; if (lenis) lenis.start(); body.style.paddingRight = ''; body.classList.remove('scroll-locked'); } }
  function scrollToY(y) { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }

  /* helper: tween that is instant under reduced motion */
  function go(t, vars) {
    if (!R()) return gsap.to(t, vars);
    var v = {}; for (var k in vars) if (k !== 'duration' && k !== 'ease' && k !== 'stagger' && k !== 'delay' && k !== 'onComplete') v[k] = vars[k];
    gsap.set(t, v); if (vars.onComplete) vars.onComplete(); return null;
  }

  /* ---------------------------------------------------------------- UI layer (functional) */
  var lastTrigger = null;
  function viaKey(e) { return e && e.detail === 0; }

  function initUI() {
    initMenu(); initModals(); initLightbox(); initForms(); initExpand(); initFees(); initFooterAcc(); initFilters(); initRail(); initOpenHouse();
  }
  function initBasicUI() { try { initMenuBasic(); } catch (e) {} }
  function initMenuBasic() {
    var b = q('.hd-burger'), m = q('#menu'); if (!b || !m) return;
    b.addEventListener('click', function () { var o = b.getAttribute('aria-expanded') === 'true'; b.setAttribute('aria-expanded', String(!o)); m.hidden = o; });
  }

  /* ---- mobile menu: RYXjuJOv.js:29359 (outer 1.2s, bg yPercent -100 .8s power2.inOut, lines 120 .8s stagger .1 at <50%) */
  function initMenu() {
    var burger = q('.hd-burger'), menu = q('#menu'); if (!burger || !menu) return;
    var bg = q('.menu-bg', menu), panel = q('.menu-panel', menu), links = qa('.menu-link', menu), contact = q('.menu-contact', menu), layer = q('#top');
    var splits = links.map(function (l) { return SplitText.create(l, { type: 'lines', mask: 'lines', aria: 'auto' }); });
    var lines = []; splits.forEach(function (s) { lines = lines.concat(s.lines); });
    var tl = null, open = false;
    function make() {
      tl = gsap.timeline({ paused: true, onReverseComplete: function () { menu.hidden = true; } });
      tl.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0)
        .fromTo(bg, { yPercent: -100 }, { yPercent: 0, duration: 0.8, ease: 'power2.inOut' }, 0)
        .fromTo(lines, { yPercent: 120, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1, ease: 'myEase' }, 0.4)
        .fromTo(contact, { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'myEase' }, 0.3);
    }
    make();
    function setOpen(o, e) {
      if (o === open) return; open = o;
      burger.setAttribute('aria-expanded', String(o)); burger.setAttribute('aria-label', o ? 'Loka valmynd' : 'Opna valmynd');
      burger.closest('.hd').classList.toggle('is-menu', o); // logo + burger turn white on the navy menu
      if (o) {
        menu.hidden = false; lock(); layer.inert = true;
        if (R()) { tl.progress(1); } else { tl.timeScale(1).play(); }
        // focus-guard: pointer open focuses the panel, keyboard open the first item (nothing highlighted on a tap)
        (viaKey(e) ? links[0] : panel).focus({ preventScroll: true });
      } else {
        unlock(); layer.inert = false;
        if (R()) { tl.progress(0); menu.hidden = true; } else { tl.timeScale(2).reverse(); }
        if (viaKey(e) || (e && e.type === 'keydown')) burger.focus({ preventScroll: true });
      }
    }
    burger.addEventListener('click', function (e) { setOpen(!open, e); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false, e); });
    links.forEach(function (l) { l.addEventListener('click', function () { if (open) { unlock(); layer.inert = false; } }); });
    addEventListener('resize', function () { if (open && innerWidth > 650) { open = false; burger.closest('.hd').classList.remove('is-menu'); burger.setAttribute('aria-expanded', 'false'); tl.progress(0); menu.hidden = true; unlock(); layer.inert = false; } });
  }

  /* ---- right-side modal: RYXjuJOv.js:29885 (overlay .4 myEase, panel xPercent 100 -> 0 .8 myEase) */
  var modalOpen = null;
  function openModal(m, e, onOpen) {
    if (!m) return;
    lastTrigger = viaKey(e) ? (e.currentTarget || e.target) : null;
    var ov = q('.modal-ov', m), p = q('.modal-panel', m);
    if (onOpen) onOpen(m);
    var wasHidden = m.hidden; // an interrupted close retargets from the current position (no snap back to the start)
    gsap.killTweensOf([ov, p]); m.hidden = false; if (wasHidden) lock(); else if (locks < 1) lock(); q('#top').inert = true; modalOpen = m;
    if (wasHidden) { gsap.set(p, { xPercent: R() ? 0 : 100 }); gsap.set(ov, { opacity: R() ? 1 : 0 }); }
    go(ov, { opacity: 1, duration: 0.4, ease: 'myEase' }); go(p, { xPercent: 0, duration: 0.8, ease: 'myEase' });
    (viaKey(e) ? (q('.modal-x', m) || p) : p).focus({ preventScroll: true });
  }
  function closeModal(m) {
    if (!m || m.hidden) return;
    var ov = q('.modal-ov', m), p = q('.modal-panel', m); if (modalOpen !== m) return; modalOpen = null; // a second close during the exit animation is ignored
    unlock(); q('#top').inert = false; gsap.killTweensOf([ov, p]);
    go(ov, { opacity: 0, duration: 0.4, ease: 'myEase' });
    go(p, { xPercent: 100, duration: 0.6, ease: 'myEase', onComplete: function () { m.hidden = true; } });
    if (lastTrigger) { lastTrigger.focus({ preventScroll: true }); lastTrigger = null; }
  }
  function initModals() {
    qa('[data-modal]').forEach(function (m) {
      qa('[data-close]', m).forEach(function (c) { c.addEventListener('click', function () { closeModal(m); }); });
    });
    qa('[data-modal-open]').forEach(function (b) { b.addEventListener('click', function (e) { openModal(q('[data-modal="' + b.dataset.modalOpen + '"]'), e); }); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOpen) closeModal(modalOpen); });
  }

  /* ---- lightbox */
  function initLightbox() {
    var lb = q('[data-lb]'); if (!lb) return;
    var list = JSON.parse(lb.dataset.json), idx = 0, img = q('.lb-img', lb), cap = q('.lb-cap', lb), ov = q('.lb-ov', lb), items = qa('[data-gl]');
    function show(i, dir) {
      idx = (i + list.length) % list.length; img.src = list[idx]; img.alt = 'Mynd ' + (idx + 1) + ' af ' + list.length; cap.textContent = (idx + 1) + ' / ' + list.length;
      gsap.killTweensOf(img);
      if (dir && !R()) gsap.fromTo(img, { autoAlpha: 0, xPercent: dir * 8 }, { autoAlpha: 1, xPercent: 0, duration: 0.6, ease: 'myEase' }); else gsap.set(img, { autoAlpha: 1, xPercent: 0 });
      var n = new Image(); n.src = list[(idx + 1) % list.length]; var p = new Image(); p.src = list[(idx - 1 + list.length) % list.length];
    }
    function open(i, e) {
      lastTrigger = viaKey(e) ? e.currentTarget : null;
      if (lb.dataset.closing) { delete lb.dataset.closing; lock(); } var was = lb.hidden; lb.hidden = false; if (was) lock(); q('#top').inert = true; show(i, 0);
      gsap.killTweensOf(ov); if (was) gsap.set(ov, { opacity: R() ? 1 : 0 }); go(ov, { opacity: 1, duration: 0.4, ease: 'myEase' });
      (viaKey(e) ? q('.lb-x', lb) : lb).focus({ preventScroll: true });
    }
    function close() {
      if (lb.hidden || lb.dataset.closing) return; lb.dataset.closing = '1'; unlock(); q('#top').inert = false; gsap.killTweensOf(ov);
      go(ov, { opacity: 0, duration: 0.4, ease: 'myEase', onComplete: function () { lb.hidden = true; delete lb.dataset.closing; } });
      if (lastTrigger) { lastTrigger.focus({ preventScroll: true }); lastTrigger = null; }
    }
    items.forEach(function (b) { b.addEventListener('click', function (e) { open(+b.dataset.gl, e); }); });
    qa('[data-gl-open]').forEach(function (b) { b.addEventListener('click', function (e) { open(+b.dataset.glOpen, e); }); });
    qa('[data-lb-close]', lb).forEach(function (c) { c.addEventListener('click', close); });
    q('[data-lb-next]', lb).addEventListener('click', function () { show(idx + 1, 1); });
    q('[data-lb-prev]', lb).addEventListener('click', function () { show(idx - 1, -1); });
    d.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(idx + 1, 1); else if (e.key === 'ArrowLeft') show(idx - 1, -1);
    });
    var sx = null;
    lb.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    lb.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
  }

  /* ---- enquiry forms (send nothing) */
  function initForms() {
    qa('[data-enq]').forEach(function (f) {
      var err = q('.err', f), ok = q('.ok', f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var n = f.elements.n, s = f.elements.s, m = f.elements.e, bad = false;
        [n, s, m].forEach(function (el) { el.removeAttribute('aria-invalid'); });
        if (!n.value.trim()) { n.setAttribute('aria-invalid', 'true'); bad = true; }
        if (!s.value.trim()) { s.setAttribute('aria-invalid', 'true'); bad = true; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.value.trim())) { m.setAttribute('aria-invalid', 'true'); bad = true; }
        err.hidden = !bad; ok.hidden = true; if (!err.id) err.id = 'err-' + Math.random().toString(36).slice(2, 7);
        qa('[aria-invalid]', f).forEach(function (el) { el.setAttribute('aria-describedby', err.id); });
        [n, s, m].forEach(function (el) { if (!el.hasAttribute('aria-invalid')) el.removeAttribute('aria-describedby'); });
        if (bad) { var first = q('[aria-invalid]', f); if (first) first.focus({ preventScroll: true }); return; }
        ok.hidden = false;
        if (!R()) gsap.fromTo(ok, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'myEase' });
      });
    });
  }

  /* ---- height 0 <-> auto, measured by GSAP: description (.55 open / .45 close) */
  function initExpand() {
    qa('[data-expand]').forEach(function (box) {
      var btn = q('[data-expand-btn]', box), body_ = q('[data-expand-body]', box), label = q('[data-expand-label]', box);
      btn.addEventListener('click', function () {
        var o = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!o)); label.textContent = o ? 'Sjá meira' : 'Sjá minna';
        gsap.killTweensOf(body_);
        if (R()) { gsap.set(body_, { height: o ? 0 : 'auto' }); return; }
        gsap.to(body_, { height: o ? 0 : 'auto', duration: o ? 0.45 : 0.55, ease: 'myEase', onComplete: function () { ScrollTrigger.refresh(); } });
      });
    });
  }
  /* ---- fee schedule, one open at a time (VOZf0EM4.js:78) */
  function initFees() {
    var all = qa('[data-fq]'); if (!all.length) return;
    function setPanel(fq, o) {
      var b = q('.fq-btn', fq), p = q('.fq-body', fq); b.setAttribute('aria-expanded', String(o)); gsap.killTweensOf(p);
      if (R()) { gsap.set(p, { height: o ? 'auto' : 0 }); return; }
      gsap.to(p, { height: o ? 'auto' : 0, duration: o ? 0.55 : 0.45, ease: 'myEase', onComplete: function () { ScrollTrigger.refresh(); } });
    }
    all.forEach(function (fq) {
      q('.fq-btn', fq).addEventListener('click', function () {
        var o = q('.fq-btn', fq).getAttribute('aria-expanded') === 'true';
        all.forEach(function (x) { if (x !== fq && q('.fq-btn', x).getAttribute('aria-expanded') === 'true') setPanel(x, false); });
        setPanel(fq, !o);
      });
    });
  }
  /* ---- footer columns become accordions at <=650px (TVdqJEKS.js:176) */
  function initFooterAcc() {
    var cols = qa('.ft-col'); if (!cols.length) return;
    cols.forEach(function (c) {
      var b = q('.ft-head', c), p = q('.ft-body', c);
      b.addEventListener('click', function () {
        if (innerWidth > 650) return;
        var o = b.getAttribute('aria-expanded') === 'true';
        cols.forEach(function (x) { var xb = q('.ft-head', x), xp = q('.ft-body', x); if (x !== c && xb.getAttribute('aria-expanded') === 'true') { xb.setAttribute('aria-expanded', 'false'); gsap.to(xp, { height: 0, autoAlpha: 0, duration: R() ? 0 : 0.65, ease: 'myEase' }); } });
        b.setAttribute('aria-expanded', String(!o));
        gsap.to(p, { height: o ? 0 : 'auto', autoAlpha: o ? 0 : 1, duration: R() ? 0 : 0.65, ease: 'myEase', onComplete: function () { ScrollTrigger.refresh(); } });
      });
    });
    addEventListener('resize', function () { if (innerWidth > 650) qa('.ft-body').forEach(function (p) { gsap.set(p, { clearProps: 'height,opacity,visibility' }); }); });
  }

  /* ---- listings filter (CNK-Zhky.js: 100 ms debounce, 400 ms for flags, skeleton aria-busy, empty state) */
  function initFilters() {
    var form = q('.f'), grid = q('[data-grid]'); if (!form || !grid) return;
    var items = qa('.rs-item', grid), skel = q('[data-skel]'), empty = q('[data-empty]'), count = q('[data-count]'), sort = q('[data-sort]');
    var side = q('[data-filters]'), opener = q('[data-filter-open]'), closer = q('[data-filter-close]'), overlay = null, timer = 0, token = 0;
    var original = items.slice();
    function state() {
      var fd = new FormData(form);
      return { q: (fd.get('q') || '').toString().trim().toLowerCase(), area: fd.getAll('area'), type: fd.getAll('type'), rooms: +fd.get('rooms') || 0, pmin: +fd.get('pmin') || 0, pmax: +fd.get('pmax') || 0, smin: +fd.get('smin') || 0, smax: +fd.get('smax') || 0, flag: fd.getAll('flag') };
    }
    function match(li, s) {
      var D_ = li.dataset, price = +D_.price, size = +D_.size, rooms = +D_.rooms;
      if (s.q && (D_.title + ' ' + D_.post + ' ' + D_.place).indexOf(s.q) < 0) return false;
      if (s.area.length && s.area.indexOf(D_.post) < 0) return false;
      if (s.type.length && s.type.indexOf(D_.type) < 0) return false;
      if (s.rooms && rooms < s.rooms) return false;
      if (s.pmin && price < s.pmin) return false; if (s.pmax && price > s.pmax) return false;
      if (s.smin && size < s.smin) return false; if (s.smax && size > s.smax) return false;
      if (s.flag.length && !s.flag.every(function (f) { return (D_.flags || '').split(' ').indexOf(f) >= 0; })) return false;
      return true;
    }
    function order(list, mode) {
      var a = list.slice(); var P = function (x) { return +x.dataset.price; };
      if (mode === 'old') a.reverse(); else if (mode === 'pasc') a.sort(function (x, y) { return P(x) - P(y); }); else if (mode === 'pdesc') a.sort(function (x, y) { return P(y) - P(x); });
      else if (mode === 'size') a.sort(function (x, y) { return +y.dataset.size - +x.dataset.size; });
      else if (mode === 'alpha') a.sort(function (x, y) { return x.dataset.title.localeCompare(y.dataset.title, 'is'); });
      return a;
    }
    function render() {
      var s = state(), vis = order(original.filter(function (li) { return match(li, s); }), sort.value);
      original.forEach(function (li) { li.hidden = vis.indexOf(li) < 0; });
      vis.forEach(function (li) { grid.appendChild(li); });
      count.textContent = vis.length + (vis.length === 1 ? ' eign' : ' eignir');
      empty.hidden = vis.length > 0; grid.hidden = vis.length === 0;
      skel.hidden = true; grid.setAttribute('aria-busy', 'false');
      gsap.killTweensOf(vis);
      if (!R() && vis.length) gsap.fromTo(vis, { autoAlpha: 0, yPercent: 6 }, { autoAlpha: 1, yPercent: 0, duration: 0.6, ease: 'myEase', stagger: 0.06, clearProps: 'opacity,visibility,transform' });
      else gsap.set(vis, { clearProps: 'opacity,visibility,transform' });
      var u = new URLSearchParams(); // every filter is deep-linkable
      if (s.q) u.set('q', s.q); if (s.area.length) u.set('area', s.area.join(',')); if (s.type.length) u.set('type', s.type.join(','));
      if (s.rooms) u.set('rooms', s.rooms); ['pmin', 'pmax', 'smin', 'smax'].forEach(function (k) { if (s[k]) u.set(k, s[k]); });
      if (s.flag.length) u.set('flag', s.flag.join(',')); if (sort.value !== 'new') u.set('sort', sort.value);
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
    }
    function schedule(ms, loading) {
      clearTimeout(timer); var t = ++token;
      timer = setTimeout(function () {
        if (loading && !R()) { grid.setAttribute('aria-busy', 'true'); skel.hidden = false; empty.hidden = true; grid.hidden = true; setTimeout(function () { if (t === token) render(); }, 220); }
        else render();
      }, R() ? 0 : ms);
    }
    form.addEventListener('input', function (e) { var n = e.target.name; schedule(n === 'flag' ? 400 : n === 'q' ? 250 : 100, n === 'flag'); });
    form.addEventListener('change', function () { schedule(100, false); });
    sort.addEventListener('change', function () { schedule(100, false); });
    qa('[data-clear]').forEach(function (b) { b.addEventListener('click', function () { form.reset(); sort.value = 'new'; schedule(0, false); }); });
    // initial state from the URL
    var u0 = new URLSearchParams(location.search);
    function many(name) { return (u0.get(name) || '').split(',').filter(Boolean); }
    ['area', 'type', 'flag'].forEach(function (nm) { many(nm).forEach(function (v) { var c = q('input[name=' + nm + '][value="' + v + '"]', form); if (c) c.checked = true; }); });
    if (u0.get('q')) form.elements.q.value = u0.get('q');
    if (u0.get('rooms')) { var rr = q('input[name=rooms][value="' + u0.get('rooms') + '"]', form); if (rr) rr.checked = true; }
    ['pmin', 'pmax', 'smin', 'smax'].forEach(function (k) { if (u0.get(k)) form.elements[k].value = u0.get(k); });
    if (u0.get('sort')) sort.value = u0.get('sort');
    render();
    /* filter sheet <=967px: same right-panel motion as the modals */
    function sheetOpen(e) {
      if (innerWidth > 967) return; lastTrigger = viaKey(e) ? opener : null;
      overlay = overlay || d.createElement('div'); overlay.className = 'modal-ov-filter'; d.body.appendChild(overlay); overlay.addEventListener('click', sheetClose);
      var was = !side.classList.contains('is-open'); gsap.killTweensOf([side, overlay]); side.classList.add('is-open'); opener.setAttribute('aria-expanded', 'true'); if (was) { lock(); gsap.set(side, { xPercent: R() ? 0 : 100 }); gsap.set(overlay, { opacity: R() ? 1 : 0 }); }
      go(overlay, { opacity: 1, duration: 0.4, ease: 'myEase' }); go(side, { xPercent: 0, duration: 0.8, ease: 'myEase' });
      (viaKey(e) ? closer : side).focus({ preventScroll: true });
    }
    function sheetClose() {
      if (!side.classList.contains('is-open')) return; opener.setAttribute('aria-expanded', 'false'); unlock();
      go(overlay, { opacity: 0, duration: 0.4, ease: 'myEase' });
      go(side, { xPercent: 100, duration: 0.6, ease: 'myEase', onComplete: function () { side.classList.remove('is-open'); if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } });
      if (lastTrigger) { lastTrigger.focus({ preventScroll: true }); lastTrigger = null; }
    }
    opener.addEventListener('click', sheetOpen); closer.addEventListener('click', sheetClose);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') sheetClose(); });
    addEventListener('resize', function () { if (innerWidth > 967 && side.classList.contains('is-open')) { side.classList.remove('is-open'); unlock(); gsap.set(side, { clearProps: 'transform' }); if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } if (innerWidth > 967) gsap.set(side, { clearProps: 'transform' }); });
  }

  /* ---- services rail: native horizontal scroller (drag with a mouse, swipe, trackpad, buttons); no wheel hijack */
  function initRail() {
    var track = q('[data-rail-track]'); if (!track) return;
    var fill = q('[data-rail-fill]'), prev = q('[data-rail-prev]'), next = q('[data-rail-next]');
    function progress() { var max = track.scrollWidth, vis = track.clientWidth; var f = Math.max(0.33, Math.min(1, (track.scrollLeft + vis) / max)); gsap.set(fill, { scaleX: f }); }
    var pf = 0; track.addEventListener('scroll', function () { if (pf) return; pf = requestAnimationFrame(function () { pf = 0; progress(); }); }, { passive: true }); addEventListener('resize', progress); progress();
    function step(dir) { var c = q('.rl-card', track); var w = (c ? c.getBoundingClientRect().width : 300) + parseFloat(getComputedStyle(track).columnGap || 18); track.scrollBy({ left: dir * w, behavior: R() ? 'auto' : 'smooth' }); }
    prev.addEventListener('click', function () { step(-1); }); next.addEventListener('click', function () { step(1); });
    var down = false, sx = 0, sl = 0, moved = 0;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = 0; sx = e.clientX; sl = track.scrollLeft; });
    addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 5) { track.classList.add('is-drag'); track.scrollLeft = sl - dx; } });
    addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-drag'); });
    track.addEventListener('click', function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  }

  /* ---- hero vertical card: creative-effect keyframes from BzRVmgDF.js:237, autoplay 3000, speed 1200 */
  var OH = null;
  function initOpenHouse() {
    var box = q('[data-oh]'); if (!box) return;
    var cards = qa('.oh-card', box), n = cards.length, i = 0, timer = null, paused = false, vis = true, userPaused = false, pbtn = q('[data-oh-pause]', box);
    var S = { cur: { yPercent: 0, z: 0, rotationX: 0, scale: 1, opacity: 1 }, prev: { yPercent: -140, z: -500, rotationX: -20, scale: 1.1, opacity: 0.2 }, next: { yPercent: 130, z: 0, rotationX: 0, scale: 0.8, opacity: 1 } };
    function rel(j, k) { var r = (j - k + n) % n; return r === 0 ? 'cur' : r === n - 1 ? 'prev' : 'next'; }
    function mark(k) { cards.forEach(function (c, j) { var cur = j === k; c.setAttribute('aria-hidden', String(!cur)); if (cur) c.removeAttribute('inert'); else c.setAttribute('inert', ''); }); }
    function apply(k, animate, dir) {
      var prevI = i; i = (k + n) % n;
      cards.forEach(function (c, j) {
        var to = S[rel(j, i)], from = S[rel(j, prevI)];
        gsap.killTweensOf(c);
        // NEVER hand GSAP the shared state objects: gsap.set() writes duration:0 into the vars it is given, which silently made every later flip instant
        if (!animate || R()) { gsap.set(c, Object.assign({}, to)); return; }
        var wasOff = (from === S.prev && to === S.next) || (from === S.next && to === S.prev);
        if (wasOff) { gsap.set(c, Object.assign({}, to)); return; } // jumps between the two off-screen slots are invisible (stack is clipped)
        gsap.to(c, Object.assign({}, to, { duration: 1.2, ease: 'myEase', overwrite: true }));
      });
      mark(i);
    }
    var armed = false;
    OH = { go: function (dir) { apply(i + dir, true, dir); }, i: function () { return i; }, arm: function () { if (armed) return; armed = true; start(); } };
    window.__mkOH = OH;
    apply(0, false); // initial
    function tick() { if (!paused && !userPaused && vis && !d.hidden && !R()) OH.go(1); }
    function start() { stop(); if (R() || n < 2 || userPaused) return; timer = setInterval(tick, 3000); }
    if (pbtn) pbtn.addEventListener('click', function () { userPaused = !userPaused; pbtn.setAttribute('aria-pressed', String(userPaused)); pbtn.setAttribute('aria-label', userPaused ? 'Hefja sjálfvirka skiptingu' : 'Stöðva sjálfvirka skiptingu'); if (userPaused) stop(); else start(); });
    if (R() && pbtn) pbtn.hidden = true;
    function stop() { clearInterval(timer); }
    q('[data-oh-next]', box).addEventListener('click', function () { OH.go(1); if (armed) start(); });
    q('[data-oh-prev]', box).addEventListener('click', function () { OH.go(-1); if (armed) start(); });
    box.addEventListener('mouseenter', function () { paused = true; }); box.addEventListener('mouseleave', function () { paused = false; });
    box.addEventListener('focusin', function () { paused = true; }); box.addEventListener('focusout', function () { paused = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[en.length - 1].isIntersecting; }).observe(box); // the newest record, not the first of a batch
    // autoplay starts after the hero intro has finished (see heroIntro), never during the reveal; failsafe if the intro never reports
    setTimeout(function () { OH.arm(); }, 12000);
  }

  /* ---------------------------------------------------------------- motion layer */
  var ctx = null, ac = null, lastW = innerWidth;

  function lineReveal(el, opts) {
    opts = opts || {};
    var sp = SplitText.create(el, { type: 'lines', mask: 'lines', aria: 'auto' });
    var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 87%', end: 'bottom 87%' } });
    tl.from(sp.lines, { yPercent: 120, autoAlpha: 0, duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0);
    var em = qa('em', el);
    if (em.length) { var ch = SplitText.create(em, { type: 'chars', aria: 'none' }); tl.from(ch.chars, { yPercent: 40, autoAlpha: 0, filter: 'blur(2px)', duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0); }
    return tl;
  }

  function rollButtons(signal) {
    if (R() || !fineMQ.matches) return;
    qa('.btn .btn-label, .hd-link .btn-label').forEach(function (lab) {
      qa('.btn-clone', lab).forEach(function (c) { c.parentNode.removeChild(c); }); // rebuilds must not stack clones
      var orig = q('.btn-orig', lab) || (lab.firstChild && lab.firstChild.nodeType === 3 ? wrapText(lab) : null);
      if (!orig) return;
      var txt = orig.textContent; if (!txt.trim()) return;
      var clone = d.createElement('span'); clone.className = 'btn-clone'; clone.setAttribute('aria-hidden', 'true'); clone.textContent = txt; lab.appendChild(clone);
      var a = SplitText.create(orig, { type: 'chars', aria: 'none' });
      var b = SplitText.create(clone, { type: 'chars', aria: 'none' });
      lab.setAttribute('aria-label', txt);
      gsap.set(b.chars, { yPercent: 130 });
      var tl = gsap.timeline({ paused: true }).fromTo(a.chars, { yPercent: 0 }, { yPercent: -130, duration: 0.52, stagger: 0.01, ease: 'myEase' }, 0).fromTo(b.chars, { yPercent: 130 }, { yPercent: 0, duration: 0.52, stagger: 0.01, ease: 'myEase' }, 0);
      var host = lab.closest('a,button') || lab;
      host.addEventListener('mouseenter', function () { if (tl.isActive()) return; tl.restart(); }, { signal: signal });
    });
  }
  function wrapText(lab) { var s = d.createElement('span'); s.className = 'btn-orig'; s.style.display = 'inline-block'; s.textContent = lab.firstChild.textContent; lab.replaceChild(s, lab.firstChild); return s; }

  function headerStates() {
    var hd = q('[data-header]'), hero = q('[data-header-over]'); if (!hd) return;
    var over = false, past = false, hh = hd.offsetHeight;
    function apply() { hd.classList.toggle('is-over', over); hd.classList.toggle('has-bg', !over && past); }
    // ScrollTrigger callbacks only: no layout reads in a scroll handler
    // start at 'top bottom' (not 'top top'): at scroll 0 the hero top sits exactly on 'top top', which ScrollTrigger treats as not yet active, leaving a dark header over the photo
    if (hero) ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top+=' + Math.round(hh * 0.6), onToggle: function (st) { over = st.isActive; apply(); } });
    ScrollTrigger.create({ start: 24, end: 'max', onToggle: function (st) { past = st.isActive; apply(); } });
    var bc = q('.hd-bottom'); if (bc && hero) {
      ScrollTrigger.create({ trigger: hero, start: 'bottom 70%', onEnter: function () { go(bc, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'myEase' }); }, onLeaveBack: function () { go(bc, { autoAlpha: 0, y: 20, duration: 0.42, ease: 'myEase' }); } });
      ScrollTrigger.create({ trigger: '.ft', start: 'top 100%', onEnter: function () { go(bc, { autoAlpha: 0, y: 20, duration: 0.42 }); }, onLeaveBack: function () { go(bc, { autoAlpha: 1, y: 0, duration: 0.42 }); } });
    }
  }

  /* hero intro: BzRVmgDF.js:397. Positions in seconds: the reference's "<50%" / "<30%" / "<-60%" resolve to 0, .6, 1.05, .03, .53 */
  function heroIntro(withIntro) {
    var title = q('[data-hero-title]'), p = q('[data-hero-p]'), card = q('[data-hero-card]'), cta = q('[data-hero-cta]');
    var sp = SplitText.create(title, { type: 'lines', mask: 'lines', aria: 'auto' });
    var em = qa('em', title), ch = em.length ? SplitText.create(em, { type: 'chars', aria: 'none' }) : null;
    var tl = gsap.timeline({ paused: true, onComplete: function () { if (window.__mkOH) window.__mkOH.arm(); } });
    tl.fromTo(sp.lines, { yPercent: 120 }, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0);
    if (ch) tl.fromTo(ch.chars, { yPercent: 40, autoAlpha: 0, filter: 'blur(5px)' }, { yPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0.6);
    tl.fromTo(p, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.5, ease: 'myEase' }, 1.05)
      .fromTo(card, { yPercent: 130, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.7, ease: 'myEase' }, 0.03)
      .fromTo(cta, { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, duration: 1, ease: 'myEase' }, 0.53)
      .fromTo('[data-header]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'myEase' }, 0.2);
    gsap.set([title, p], { visibility: 'visible' }); tl.progress(0.0001);
    return tl;
  }

  /* inner hero: DbXOWUZX.js:27 (title/paragraph lines 1.2s stagger .3/.1, italic chars at <, image clip 1.1s sine.inOut, bg scale 1.15 scrub 1.4) */
  function innerIntro() {
    var hero = q('[data-inner-hero]'), title = q('[data-hero-title]'), p = q('[data-hero-p]'); if (!hero || !title) return null;
    var st = SplitText.create(title, { type: 'lines', mask: 'lines', aria: 'auto' }), sp = p ? SplitText.create(p, { type: 'lines', mask: 'lines', aria: 'auto' }) : null;
    var em = qa('em', title), ch = em.length ? SplitText.create(em, { type: 'chars', aria: 'none' }) : null;
    var tl = gsap.timeline({ paused: true });
    var bg = q('[data-inner-bg]'); if (bg) { tl.fromTo(bg, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'sine.inOut' }, 0); gsap.to(q('img', bg), { scale: 1.15, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', scrub: 1.4 } }); }
    tl.fromTo(st.lines, { yPercent: 120 }, { yPercent: 0, duration: 1.2, stagger: 0.3, ease: 'myEase' }, 0);
    if (sp) tl.fromTo(sp.lines, { yPercent: 120 }, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0);
    if (ch) tl.fromTo(ch.chars, { yPercent: 40, autoAlpha: 0, filter: 'blur(5px)' }, { yPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.1, ease: 'myEase' }, 0);
    var crumb = q('.crumb', hero); if (crumb) tl.fromTo(crumb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'myEase' }, 0.3);
    gsap.set([title, p], { visibility: 'visible' }); tl.progress(0.0001);
    return tl;
  }

  function theme() {
    var s = q('[data-theme-section]'); if (!s) return;
    // RYXjuJOv.js:21805; section override ends at bottom top
    ScrollTrigger.create({ trigger: s, start: 'top 25%', end: 'bottom top', onToggle: function (self) { body.dataset.theme = self.isActive ? 'blue' : 'light'; } });
  }

  function factsRoll() {
    qa('.fact-roll').forEach(function (el) {
      var txt = el.closest('.fact-n').dataset.n, cols = [];
      el.setAttribute('aria-label', txt); el.innerHTML = '';
      txt.split('').forEach(function (c) {
        if (/\d/.test(c)) {
          var n = +c, dg = d.createElement('span'), col = d.createElement('span'); dg.className = 'dg'; dg.setAttribute('aria-hidden', 'true'); col.className = 'dg-col';
          for (var k = 0; k <= n; k++) { var i = d.createElement('i'); i.textContent = k; col.appendChild(i); }
          dg.appendChild(col); el.appendChild(dg); dg.style.width = col.lastChild.getBoundingClientRect().width + 'px'; if (n > 0) cols.push([col, n]);
        } else { var s = d.createElement('span'); s.textContent = c; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); }
      });
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 96%' } });
      cols.forEach(function (cn, idx) { tl.fromTo(cn[0], { yPercent: 0 }, { yPercent: -100 * cn[1] / (cn[1] + 1), duration: 1.2, ease: 'sine.inOut' }, idx * 0.15); });
      if (!cols.length) tl.set({}, {});
    });
  }

  /* chooser: B0UG9CdE.js:42-46 */
  function chooser(signal) {
    var list = q('[data-ch-list]'); if (!list) return;
    qa('.ch-row', list).forEach(function (row) { gsap.from(row, { autoAlpha: 0, xPercent: -20, duration: 1, ease: 'myEase', scrollTrigger: { trigger: row, start: 'top 80%' } }); });
    if (!fineMQ.matches || R()) return;
    var imgs = qa('.ch-img'), z = 2, cur = 0, busy = false, pending = null;
    gsap.set(imgs.slice(1), { clipPath: 'inset(100% 100% 0 0)' });
    function show(j) {
      if (j === cur) return; if (busy) { pending = j; return; }
      busy = true; var im = imgs[j]; z++;
      if (z > 30) { imgs.forEach(function (x) { x.style.zIndex = 0; }); imgs[cur].style.zIndex = 1; z = 2; }
      im.style.zIndex = z;
      gsap.fromTo(im, { clipPath: 'inset(100% 100% 0 0)' }, { clipPath: 'inset(0% 0% 0 0)', duration: 1.5, ease: 'myEase', onComplete: function () { busy = false; cur = j; if (pending !== null && pending !== cur) { var n = pending; pending = null; show(n); } else pending = null; } });
    }
    qa('.ch-link', list).forEach(function (a, j) {
      a.addEventListener('mouseenter', function () { pending = null; show(j); }, { signal: signal });
      a.addEventListener('focus', function () { if (!root.matches('[data-input="pointer"]')) show(j); }, { signal: signal });
    });
  }

  /* featured pin: C1P57biK.js:60-213 */
  function featuredPin(signal) {
    var sec = q('[data-pin-section]'); if (!sec) return;
    var wrap = q('[data-pin]', sec), bgs = qa('.pin-bg', sec), thumbs = qa('.pin-thumb', sec), titles = qa('.pin-title', sec), counts = qa('.pin-count', sec), descs = qa('.pin-desc', sec), card = q('[data-pin-card]', sec), cursor = q('[data-cursor]', sec);
    var l = bgs.length - 1, I = 1 / l, END = '+=' + (l * 80) + '%', SC = l > 0 ? 1.25 : false, g = 0, seen = false;
    gsap.from(card, { yPercent: 200, duration: 1.5, ease: 'power3.out', scrollTrigger: { trigger: wrap, start: 'top 60%' } });
    var descSplits = descs.map(function (dd) { return SplitText.create(dd, { type: 'lines', mask: 'lines', aria: 'auto' }); });
    descSplits.forEach(function (s, m) { gsap.set(s.lines, { yPercent: m === 0 ? 0 : 110 }); });
    gsap.set(descs, { autoAlpha: 1 });
    gsap.to(qa('.pin-thumb-img', sec), { scale: 1.1, ease: 'none', scrollTrigger: { trigger: wrap, scrub: SC, start: 'top top', end: END } });
    gsap.set(bgs.slice(1), { clipPath: 'inset(100% 0 0 0)', scale: 1.1 });
    gsap.set(thumbs.slice(1), { clipPath: 'inset(100% 0 0 0)' });
    function discrete(p) {
      var m = Math.max(0, Math.min(1, p)), f = Math.floor(m / I + 0.5);
      if (!seen) {
        seen = true;
        // Reference gates until index 0 is seen (a jump into the pin leaves the title behind). Deviation: when the first update lands
        // inside the pin (refresh, back, anchor) sync title/counter/description instantly instead, so text never contradicts the photograph.
        if (f !== 0) { g = f; gsap.set(titles.concat(counts), { yPercent: -100 * f }); descSplits.forEach(function (sp, k) { gsap.set(sp.lines, { yPercent: k === f ? 0 : 110 }); }); return; }
      }
      if (f === g) return;
      descSplits.forEach(function (s) { gsap.killTweensOf(s.lines); });
      gsap.to(titles.concat(counts), { yPercent: -100 * f, duration: 0.7, ease: 'myEase' });
      var outgoing = g;
      gsap.to(descSplits[outgoing].lines, { yPercent: f > g ? -110 : 110, duration: 0.4, ease: 'myEase', stagger: 0.05, onComplete: function () { gsap.to(descSplits[f].lines, { yPercent: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05 }); } });
      g = f;
    }
    var H = gsap.timeline({ scrollTrigger: { trigger: wrap, start: 'top top', end: END, scrub: SC, pin: true, invalidateOnRefresh: true, refreshPriority: 1, onUpdate: function (s) { discrete(s.progress); } } });
    bgs.slice(1).forEach(function (c, m) { H.to([c, thumbs[m + 1]], { clipPath: 'inset(0% 0 0 0)', scale: 1, ease: 'power2.inOut' }, I * m); });
    // parallax entry of the first photograph (trigger = the pinned element, ends where the pin starts)
    gsap.from(bgs[0], { yPercent: -30, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true } });
    /* hover label (fine pointers only) and click -> right-side detail panel */
    var mod = q('[data-modal="pin"]');
    function openFor(e) {
      var data = JSON.parse(mod.dataset.json)[g];
      openModal(mod, e, function (m) {
        q('.modal-img', m).innerHTML = '<img alt="" src="' + data.img + '">'; q('.modal-place', m).textContent = data.place; q('.modal-title', m).textContent = data.title;
        q('.modal-line', m).textContent = data.line; q('.modal-facts', m).textContent = data.facts; q('.modal-price', m).textContent = data.price; q('.modal-link', m).setAttribute('href', 'eign/' + data.id + '/');
      });
    }
    q('[data-pin-open]', sec).addEventListener('click', function (e) { e.stopPropagation(); openFor(e); }, { signal: signal });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-pin-open]')) return; openFor(e); }, { signal: signal });
    if (fineMQ.matches) {
      var qx = gsap.quickTo(cursor, 'x', { duration: 0.7, ease: 'power3.out' }), qy = gsap.quickTo(cursor, 'y', { duration: 0.7, ease: 'power3.out' });
      wrap.addEventListener('pointermove', function (e) { qx(e.clientX + 14); qy(e.clientY + 14); }, { signal: signal });
      wrap.addEventListener('pointerenter', function (e) { gsap.set(cursor, { x: e.clientX + 14, y: e.clientY + 14 }); gsap.to(cursor, { opacity: 1, duration: 0.21 }); }, { signal: signal });
      wrap.addEventListener('pointerleave', function () { gsap.to(cursor, { opacity: 0, duration: 0.21 }); }, { signal: signal });
    }
  }

  function reveals() {
    qa('[data-lines]').forEach(function (el) { if (el.closest('[data-header-over]')) return; lineReveal(el); });
    // inline photographs in the statement: _L7lRmvn.js:132 (yPercent 120, alpha 0, blur 2px, rotate 20, 1.2s, stagger .2)
    var inl = qa('.statement-title .inl'); if (inl.length) gsap.from(inl, { yPercent: 120, autoAlpha: 0, rotation: 20, filter: 'blur(2px)', duration: 1.2, stagger: 0.2, ease: 'myEase', scrollTrigger: { trigger: '.statement-title', start: 'top 87%' } });
    qa('[data-fade]').forEach(function (el) { gsap.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'myEase', scrollTrigger: { trigger: el, start: 'top 87%' } }); });
    qa('.nw-card').forEach(function (el, i) { gsap.from(el, { autoAlpha: 0, yPercent: 6, duration: 1.2, ease: 'myEase', delay: i * 0.13, scrollTrigger: { trigger: el, start: 'top 87%' } }); gsap.fromTo(q('.nw-img img', el), { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }); });
    qa('.rl-title').forEach(function (el) { var sp = SplitText.create(el, { type: 'chars', aria: 'auto' }); gsap.from(sp.chars, { autoAlpha: 0, xPercent: 40, duration: 0.5, stagger: 0.06, ease: 'myEase', scrollTrigger: { trigger: el, start: 'top 87%' } }); });
    var bar = q('.rl-bar'); if (bar) { gsap.from(bar, { xPercent: -100, duration: 0.9, ease: 'myEase', scrollTrigger: { trigger: bar, start: 'top 87%' } }); gsap.from(q('.rl-fill'), { xPercent: -100, duration: 0.9, delay: 0.3, ease: 'myEase', scrollTrigger: { trigger: bar, start: 'top 87%' } }); }
    qa('[data-parallax]').forEach(function (w) { gsap.fromTo(q('img', w), { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: w, start: 'top bottom', end: 'bottom top', scrub: true } }); });
    var cta = q('[data-cta] .cta-bg img'); if (cta) gsap.fromTo(cta, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '[data-cta]', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    qa('[data-nb]').forEach(function (a) { var im = q('[data-nb-img]', a); gsap.fromTo(im, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.1, ease: 'sine.inOut', scrollTrigger: { trigger: a, start: 'top 80%' } }); gsap.fromTo(q('img', im), { scale: 1.1 }, { scale: 1, duration: 1.1, ease: 'sine.inOut', scrollTrigger: { trigger: a, start: 'top 80%' } }); });
    qa('[data-cg]').forEach(function (el) { var c = +el.dataset.cg, sc = +(el.dataset.scale || 1.1); gsap.fromTo(q('img', el), { yPercent: -c, scale: sc }, { yPercent: c, scale: sc, ease: 'none', scrollTrigger: { trigger: '[data-collage]', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } }); });
    var ph = q('.prop-hero-pic'); if (ph) gsap.fromTo(ph, { yPercent: 0, scale: 1 }, { yPercent: -8, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.prop-hero', start: 'top top', end: 'bottom top', scrub: 1.4 } });
    qa('.info-row,.gl-item,.ow,.nbi-row,.rs-foot,.fq').forEach(function (el) { gsap.from(el, { autoAlpha: 0, yPercent: 8, duration: 1, ease: 'myEase', scrollTrigger: { trigger: el, start: 'top 90%' } }); });
  }

  function footerMark() {
    var mark = q('.ft-mark'); if (!mark) return;
    var big = qa('.ft-logo .lg-big'), small = qa('.ft-logo .lg-small'), red = q('.ft-logo .lg-red');
    var tl = gsap.timeline({ scrollTrigger: { trigger: mark, start: 'top 100%', endTrigger: '.ft', end: '98% 100%', scrub: 3 } });
    // TVdqJEKS.js:43 (paths yPercent 100, 3.3s, stagger -.5, myEase, scrub 3): the nine big letters carry the stagger, the caption and bar ride along
    tl.from(big, { yPercent: 100, duration: 3.3, stagger: -0.5, ease: 'myEase' }, 0).from(small, { yPercent: 100, duration: 3.3, stagger: { amount: -1.2 }, ease: 'myEase' }, 0).from(red, { scaleX: 0, transformOrigin: '0 50%', duration: 3.3, ease: 'myEase' }, 0.6);
  }

  /* preloader (RYXjuJOv.js:31286): each line of the logo drops out through its own baseline (right to left), the red bar closes to the
     centre, the whole mark is gone, THEN the navy panel lifts. Starts at once (no font wait, it is pure SVG); nothing may float over the photograph. */
  function preloader() {
    return new Promise(function (res) {
      var pre = q('.preloader'); if (!pre || !root.classList.contains('preloader-active')) { res(); return; }
      try { sessionStorage.setItem('mkPre', '1'); } catch (e) {}
      var big = qa('.pre-svg .lg-big'), small = qa('.pre-svg .lg-small'), bar = q('.pre-svg .lg-red'), bgp = q('.pre-bg'), mark = q('.pre-logo');
      var done = false; function fin() { if (done) return; done = true; res(); }
      var tl = gsap.timeline({ onComplete: function () { root.classList.remove('preloader-active'); fin(); } });
      tl.to(small, { yPercent: 110, duration: 0.45, ease: 'power2.in', stagger: { amount: 0.64, from: 'end' } }, 0.25)
        .to(big, { yPercent: 110, duration: 0.45, ease: 'power2.in', stagger: { amount: 0.64, from: 'end' } }, 0.25)
        .to(bar, { scaleX: 0.04, transformOrigin: '50% 50%', duration: 0.5, ease: 'myEase' }, '>')
        .to(mark, { autoAlpha: 0, duration: 0.5, ease: 'power1.inOut' }, '+=0.05')
        .to(bgp, { yPercent: -100, duration: 1, ease: 'myEase' }, '<0.4')
        .call(fin, null, '<');
      function skip() { tl.timeScale(5); } addEventListener('keydown', skip, { once: true }); pre.addEventListener('pointerdown', skip, { once: true });
      setTimeout(function () { root.classList.remove('preloader-active'); fin(); }, 7000);
    });
  }

  function buildMotion(intro) {
    if (ac) ac.abort(); ac = new AbortController();
    ctx = gsap.context(function () {
      rollButtons(ac.signal); headerStates(); reveals(); theme(); factsRoll(); chooser(ac.signal); featuredPin(ac.signal); footerMark();
      if (page === 'home') {
        var hi = heroIntro(); var hs = q('.hero');
        gsap.to(q('.hero-img'), { scale: 1.3, ease: 'none', scrollTrigger: { trigger: hs, start: 'top top', scrub: 1.4 } });
        gsap.to(q('.hero-ov'), { opacity: 0.9, ease: 'none', scrollTrigger: { trigger: hs, start: 'top top', scrub: 1.4 } });
        window.__mkHero = hi;
        if (intro) intro.then(function () { hi.timeScale(1).play(); }); else { hi.progress(1); if (window.__mkOH) window.__mkOH.arm(); }
      } else {
        var ii = innerIntro(); if (ii) { if (intro) intro.then(function () { ii.play(); }); else ii.progress(1); }
      }
    });
    ready();
    ScrollTrigger.refresh();
  }

  /* ---------------------------------------------------------------- boot */
  initUI();
  if (R()) { ready(); headerStates(); theme(); return; }
  initLenis();
  var fontsReady = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
  var settled = fontsReady.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }).then(function () { return window.__mkVT ? window.__mkVT.catch(function () {}) : null; });
  var introP = page === 'home' ? preloader() : settled.then(function () { return null; }); // the preloader never waits for fonts
  settled.then(function () { buildMotion(introP); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
  var rt = 0;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (innerWidth === lastW) return; lastW = innerWidth; if (ctx) ctx.revert(); buildMotion(null); }, 250); });
  addEventListener('pageshow', function (e) { if (e.persisted) ScrollTrigger.refresh(); });
})();
