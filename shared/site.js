const P = PORTFOLIO;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The strobe trails and title blur repaint large areas every frame. On touch, iOS scrolls the rail
// natively, and that repaint made it lose the first swipe and snap back, so they are mouse-only.
const trails = !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches;
document.getElementById('line').innerHTML = `${P.role}. ${P.line}`;
document.getElementById('mail').href = document.getElementById('mail2').href = P.contact.href;
const NAME_CHARS = [...P.name], NAME_GHOSTS = 6;
document.getElementById('name').innerHTML = `<span class="sr-only">${P.name}</span>` + Array.from({ length: NAME_GHOSTS + 1 }, (_, i) =>
  `<span class="${i ? 'ghost' : 'real'}" aria-hidden="true"${i ? ` style="--i:${i}"` : ''}>${NAME_CHARS.map((c) => `<span class="cell">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`).join('');

document.getElementById('plates').innerHTML = P.projects.map((p) => `
<section class="plate" id="${p.id}" aria-labelledby="t-${p.id}">
  <header class="plate-head">
    <h2 id="t-${p.id}">${p.name.replace('/', '/<wbr>')}</h2>
    <div><p>${p.summary}</p><p class="facts">${p.meta}</p></div>
  </header>
  <div class="stage">
    <blossom-carousel class="rail" tabindex="0" role="group" aria-label="${p.name}, ${p.slides.length} frames. Use the left and right arrow keys to move.">
      ${p.slides.map((s) => `<figure class="shot"><div class="frame">${Art.html(s.art, s.title, s.alt)}</div><figcaption><b class="cap">${s.title}</b><span>${s.note}</span></figcaption></figure>`).join('')}
    </blossom-carousel>
    <canvas class="ghosts" aria-hidden="true"></canvas>
  </div>
  <div class="chart">
    <canvas aria-hidden="true"></canvas>
    <div class="axis" role="group" aria-label="${p.name} frames">${p.slides.map((s, i) => `<button type="button" style="left:${(i / (p.slides.length - 1)) * 100}%">${s.axis || s.kind.replace(' prototype', '')}</button>`).join('')}</div>
    <i class="now" aria-hidden="true"></i>
  </div>
  <i class="shade" aria-hidden="true"></i>
</section>`).join('');

document.getElementById('about').innerHTML = `
  <div>
    <h2 id="t-about">About</h2>
    <button class="portrait" type="button" aria-pressed="false" aria-label="Portrait of Benjamin Fritz. Press to switch between character art and photo.">
      <picture><source srcset="shared/portrait.avif" type="image/avif"><img src="shared/portrait.jpg" width="1400" height="875" alt="" decoding="async"></picture>
      <canvas aria-hidden="true"></canvas>
    </button>
    <p class="exposure-note">Yup, that’s me. Nice to see you!</p>
  </div>
  <div class="about-copy">
    ${P.about.paragraphs.map((t) => `<p>${t}</p>`).join('')}
    <ul class="focus">${P.about.focus.map((t) => `<li>${t}</li>`).join('')}</ul>
  </div>`;

const DPR = Math.min(2, devicePixelRatio || 1);
const fit = (c) => { const r = c.getBoundingClientRect(); c.width = r.width * DPR; c.height = r.height * DPR; const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); return x; };

document.querySelectorAll('.plate').forEach((plate) => {
  const stage = plate.querySelector('.stage'), rail = plate.querySelector('.rail'), title = plate.querySelector('h2');
  const ghostC = plate.querySelector('.ghosts'), chartC = plate.querySelector('.chart canvas');
  const now = plate.querySelector('.now'), ticks = [...plate.querySelectorAll('.axis button')];
  let g = fit(ghostC), c = fit(chartC);
  let ghosts = [], running = false, last = rail.scrollLeft, lastT = performance.now(), lastStrobe = 0, speed = 0;

  // Each strobe stores where the frames were. They fade like a chronophotograph.
  const strobe = (t) => {
    const base = stage.getBoundingClientRect();
    ghosts.push({ t, r: api.slides.map((s) => s.querySelector('.frame').getBoundingClientRect()).filter((r) => r.right > 0 && r.left < innerWidth).map((r) => [r.left - base.left, r.top - base.top, r.width, r.height]) });
  };
  let prev = 0;
  const loop = (t) => {
    const dt = prev ? t - prev : 16.67; prev = t;
    g.clearRect(0, 0, ghostC.clientWidth, ghostC.clientHeight);
    ghosts = ghosts.filter((s) => t - s.t < 720);
    ghosts.forEach((s) => {
      const a = (1 - (t - s.t) / 720) ** 2;
      g.strokeStyle = `rgba(238,234,226,${a * 0.75})`; g.fillStyle = `rgba(238,234,226,${a * 0.05})`;
      s.r.forEach(([x, y, w, h]) => { g.fillRect(x, y, w, h); g.strokeRect(x + .5, y + .5, w - 1, h - 1); });
    });
    speed *= Math.pow(0.86, dt / 16.67);
    const v = Math.max(-40, Math.min(40, speed * 14));
    title.style.textShadow = Math.abs(v) < 1 ? 'none' : [1, 2, 3, 4, 5].map((n) => `${v * n}px 0 rgba(238,234,226,${0.3 - n * 0.05})`).join(',');
    if (ghosts.length || Math.abs(v) >= 1) requestAnimationFrame(loop); else { running = false; prev = 0; ghostC.style.visibility = 'hidden'; title.style.textShadow = 'none'; }
  };

  const api = Rail(rail, {
    onMove(a) {
      const t = performance.now(), x = rail.scrollLeft, dt = Math.max(8, t - lastT), v = (x - last) / dt;
      const w = chartC.clientWidth;
      now.style.transform = `translateX(${a.progress * (w - 1)}px)`;
      const i = a.index;
      ticks.forEach((b, n) => b.setAttribute('aria-current', n === i));
      if (Math.abs(x - last) > 0.5 && trails) {
        speed = v;
        if (t - lastStrobe > 55) { lastStrobe = t; strobe(t); if (!running) { running = true; ghostC.style.visibility = 'visible'; requestAnimationFrame(loop); } }
      }
      // The chart keeps every pass over this project: one bar per sample, taller when faster.
      if (Math.abs(x - last) > 0.5) {
        const h = Math.min(1, Math.abs(v) / 4) * 44 + 2;
        c.fillStyle = 'rgba(238,234,226,.42)';
        c.fillRect(a.progress * (w - 1), 48 - h, 1, h);
      }
      last = x; lastT = t;
    },
  });
  ticks.forEach((b, i) => b.addEventListener('click', () => api.go(i)));
  // Tabbing into a frame that is scrolled out of view brings that frame in, so focus stays visible.
  // Focus entering a live demo fires inside its own document, so each demo reports it too (see below).
  const reveal = (shot) => {
    const i = api.slides.indexOf(shot);
    if (i < 0) return;
    const r = shot.getBoundingClientRect(), box = rail.getBoundingClientRect();
    if (r.left < box.left - 1 || r.right > box.right + 1) api.go(i, true);
  };
  rail.addEventListener('focusin', (e) => reveal(e.target.closest('.shot')));

  // Live components run in their own document, so dragging their empty areas is forwarded to the rail.
  rail.querySelectorAll('iframe').forEach((frame) => frame.addEventListener('load', () => {
    if (!frame.getAttribute('src')) return; // The empty placeholder document, before the demo starts.
    const doc = frame.contentDocument;
    doc.addEventListener('focusin', () => reveal(frame.closest('.shot')));
    doc.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button || e.target.closest('input, button, a, label, [role=tab], [role=radio]')) return;
      const startX = e.screenX, startLeft = rail.scrollLeft, startIndex = api.index, snap = rail.style.getPropertyValue('--snap-type');
      rail.style.setProperty('--snap-type', 'none'); rail.style.scrollSnapType = 'none';
      e.target.setPointerCapture(e.pointerId);
      const move = (m) => rail.scrollTo({ left: startLeft - (m.screenX - startX), behavior: 'instant' });
      const up = () => {
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', up);
        const moved = rail.scrollLeft - startLeft;
        api.go(Math.abs(moved) > 80 ? startIndex + Math.sign(moved) : startIndex);
        setTimeout(() => { rail.style.setProperty('--snap-type', snap); rail.style.scrollSnapType = ''; }, reduced ? 0 : 450);
      };
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', up);
    });

  }));
  addEventListener('resize', () => { g = fit(ghostC); c = fit(chartC); });
});

// Stacked projects. Pinning by the bottom edge keeps tall projects fully reachable.
const stack = [...document.querySelectorAll('.plate')];
const stacked = matchMedia('(min-width: 821px)');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pin = () => stack.forEach((p) => { p.style.top = `${Math.min(0, innerHeight - p.offsetHeight)}px`; });

// A covered project dims as the next one slides over it.
let dimQueued = false;
const dim = () => {
  dimQueued = false;
  if (!stacked.matches) return;
  stack.slice(0, -1).forEach((p, i) => {
    const covered = clamp((innerHeight - stack[i + 1].getBoundingClientRect().top) / innerHeight, 0, 1);
    p.querySelector('.shade').style.opacity = covered * 0.72;
  });
};
const queueDim = () => { if (!dimQueued) { dimQueued = true; requestAnimationFrame(dim); } };
addEventListener('scroll', queueDim, { passive: true });
const layout = () => { pin(); queueDim(); };
addEventListener('resize', layout);
stacked.addEventListener('change', layout);
stack.forEach((p) => new ResizeObserver(layout).observe(p));
layout();

// Frames load lazily. Live demos are full React apps, so their iframes get no src until needed.
// In portrait each frame fills the width, so WebKit would only start the later demos during the
// first swipe, which makes it stutter. So a project's frames load one at a time while it is still
// about a screen away. That warming waits until the name has settled, so booting demos don't make
// the name animation stutter. A project whose frames are already on screen starts straight away.
let heroSettled;
const heroDone = new Promise((resolve) => { heroSettled = resolve; });
const started = new WeakSet();
const warmUp = (plate) => {
  if (started.has(plate)) return;
  started.add(plate);
  const queue = [...plate.querySelectorAll('.rail iframe[data-src], .rail img[loading="lazy"]')];
  const next = () => {
    const el = queue.shift();
    if (!el) return;
    if (el.complete) { next(); return; } // An image that already loaded fires no load event; don't wait for one.
    let done = false;
    const go = () => { if (!done) { done = true; setTimeout(next, 150); } };
    el.addEventListener('load', go, { once: true });
    setTimeout(go, 1500); // Frames that already loaded fire no load event.
    if (el.dataset.src) el.src = el.dataset.src; else el.loading = 'eager';
  };
  next();
};
const watch = (targets, rootMargin) => {
  const io = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
    if (!isIntersecting) return;
    io.unobserve(target);
    warmUp(target.closest('.plate'));
  }), { rootMargin });
  targets.forEach((t) => io.observe(t));
};
watch(stack.map((p) => p.querySelector('.stage')), '0px');
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 200));
Promise.race([heroDone, new Promise((r) => setTimeout(r, 3000))]).then(() => idle(() => watch(stack, '100% 0px')));

// Tabbing into a covered project brings the focused control out from under the next one.
document.addEventListener('focusin', (e) => {
  const plate = stacked.matches && e.target.closest('.plate');
  if (!plate) return;
  const next = stack[stack.indexOf(plate) + 1];
  const r = e.target.getBoundingClientRect();
  const hidden = r.bottom > innerHeight || r.top < 0 || (next && next.getBoundingClientRect().top < r.bottom);
  if (!hidden) return;
  // Sticky positions move with scroll, so work from the project's place in the flow.
  const flowTop = document.getElementById('plates').getBoundingClientRect().top + scrollY + stack.slice(0, stack.indexOf(plate)).reduce((sum, p) => sum + p.offsetHeight, 0);
  const inside = r.top - plate.getBoundingClientRect().top;
  scrollTo({ top: clamp(flowTop + inside - 24, flowTop, flowTop + Math.max(0, plate.offsetHeight - innerHeight)), behavior: 'instant' });
});

// The name shuffles through its own letters, then locks in from left to right. The exposures behind
// it show earlier frames, so the shuffle leaves a trail. Hover a letter (or tap, on touch) to shuffle again.
document.fonts.ready.then(() => {
  const h1 = document.getElementById('name');
  const rows = [...h1.querySelectorAll('.real, .ghost')].map((l) => [...l.children]);
  const widths = rows[0].map((c) => c.getBoundingClientRect().width);
  // In em, so the cells keep fitting when the font size changes with the viewport.
  const em = parseFloat(getComputedStyle(h1).fontSize);
  widths.forEach((w, k) => rows.forEach((row) => { row[k].style.width = (w / em) + 'em'; }));
  if (reduced) { heroSettled(); return; }
  const pool = [...new Set(NAME_CHARS.filter((c) => c !== ' '))];
  const glyph = Object.fromEntries(pool.map((c) => [c, widths[NAME_CHARS.indexOf(c)]]));
  // Each slot only borrows letters of a similar width, so a wide m never spills over a narrow j.
  const slots = NAME_CHARS.map((c, k) => {
    const near = pool.filter((p) => p !== c && glyph[p] <= widths[k] * 1.3 && glyph[p] >= widths[k] * 0.6);
    return near.length ? near : pool.filter((p) => p !== c);
  });
  const pick = (k, not) => { const s = slots[k]; let c; do c = s[Math.random() * s.length | 0]; while (c === not && s.length > 1); return c; };
  let lockAt = [], history = [], last = 0, raf = 0;
  const frame = (t) => {
    if (t - last >= 55) {
      last = t;
      const now = NAME_CHARS.map((c, k) => (c === ' ' || t >= lockAt[k]) ? c : pick(k, history[0]?.[k]));
      history.unshift(now); history.length = Math.min(history.length, NAME_GHOSTS + 1);
      rows.forEach((row, i) => { const s = history[Math.min(i, history.length - 1)]; row.forEach((cell, k) => { cell.textContent = s[k] === ' ' ? '\u00a0' : s[k]; }); });
      rows[0].forEach((cell, k) => cell.classList.toggle('live', NAME_CHARS[k] !== ' ' && t < lockAt[k]));
      if (history.length > NAME_GHOSTS && history.every((s) => s.join('') === P.name)) { raf = 0; heroSettled(); return; }
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const t0 = performance.now();
  lockAt = NAME_CHARS.map((_, k) => t0 + 300 + k * 75);
  run();
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    rows[0].forEach((cell, k) => {
      if (NAME_CHARS[k] === ' ') return;
      cell.addEventListener('pointerenter', () => { const now = performance.now(); if (lockAt[k] < now) { lockAt[k] = now + 420; run(); } });
    });
  } else {
    // Touch has no hover: a tap shuffles the nearest letter and ripples out to its neighbours.
    h1.addEventListener('click', (e) => {
      const now = performance.now();
      const centres = rows[0].map((c) => { const r = c.getBoundingClientRect(); return r.left + r.width / 2; });
      const hit = centres.reduce((best, x, k) => Math.abs(x - e.clientX) < Math.abs(centres[best] - e.clientX) ? k : best, 0);
      NAME_CHARS.forEach((c, k) => { if (c !== ' ') lockAt[k] = Math.max(lockAt[k], now + 260 + Math.abs(k - hit) * 60); });
      run();
    });
  }
});

// Section links glide to their target. Keyboard use and reduced motion jump instantly.
const cubic = (x1, y1, x2, y2) => {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < x) lo = mid; else hi = mid; }
    return at(y1, y2, (lo + hi) / 2);
  };
};
// Strong ease-in-out: this is movement across the screen, so it starts and lands gently.
const glide = cubic(0.77, 0, 0.175, 1);
const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
let stopGlide = null;

function goToSection(el, animate) {
  if (stopGlide) stopGlide();
  const from = scrollY;
  const to = Math.min(document.documentElement.scrollHeight - innerHeight, from + el.getBoundingClientRect().top);
  const land = () => el.focus({ preventScroll: true });
  const distance = Math.abs(to - from);
  if (!animate || distance < 1) { scrollTo({ top: to, behavior: 'instant' }); land(); return; }

  const duration = Math.min(1100, 600 + distance * 0.12);
  let start = 0, raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    INTERRUPTS.forEach((type) => removeEventListener(type, stop));
    stopGlide = null;
  };
  const frame = (t) => {
    start = start || t;
    const p = Math.min(1, (t - start) / duration);
    scrollTo({ top: from + (to - from) * glide(p), behavior: 'instant' });
    if (p < 1) raf = requestAnimationFrame(frame); else { stop(); land(); }
  };
  INTERRUPTS.forEach((type) => addEventListener(type, stop, { passive: true }));
  stopGlide = stop;
  raf = requestAnimationFrame(frame);
}

// The opened privacy notice grows below the fold, so bring its heading into view.
(function () {
  const details = document.getElementById('privacy'), summary = details.querySelector('summary');
  let viaKeyboard = false;
  summary.addEventListener('click', (e) => { viaKeyboard = e.detail === 0; });
  details.addEventListener('toggle', () => {
    if (!details.open || summary.getBoundingClientRect().top < innerHeight * 0.4) return;
    // Wait for the height transition, or the page is still too short to scroll that far.
    setTimeout(() => summary.scrollIntoView({ block: 'start', behavior: reduced || viaKeyboard ? 'instant' : 'smooth' }), reduced ? 0 : 280);
  });
  if (location.hash === '#privacy') details.open = true;
})();

// Portrait: character art over the photo, with a small water simulation on the grid.
// Moving water reveals the photo and bends nearby characters, then the surface heals.
(function () {
  const btn = document.querySelector('.portrait'), img = btn.querySelector('img'), cv = btn.querySelector('canvas'), ctx = cv.getContext('2d');
  const RAMP = ' .,:;-=+*oa#%@';
  const hoverable = matchMedia('(hover: hover) and (pointer: fine)');
  const STEP = 1000 / 60, DAMP = 0.987, FADE = 0.86, TENSION = 0.46, REVEAL = 0.1;
  let sheet, W, H, cw, ch, cols, rows, dpr, squash, water, previous, energy, jitter, shown, shore;
  let raf = 0, prev = 0, spare = 0, last = null, held = false, ticks = 0, ready = false, full = false, touched = false;

  function drop(cx, cy, amount, radius) {
    // A splash goes down and up with no net volume, which makes separate rings, not a disc.
    const reachX = Math.ceil(radius * 3.2), reachY = Math.ceil(reachX * cw / ch);
    for (let y = Math.max(1, Math.floor(cy - reachY)); y <= Math.min(rows - 2, Math.ceil(cy + reachY)); y++) {
      for (let x = Math.max(1, Math.floor(cx - reachX)); x <= Math.min(cols - 2, Math.ceil(cx + reachX)); x++) {
        const dx = x - cx, dy = (y - cy) * ch / cw;
        const q = (dx * dx + dy * dy) / (2 * radius * radius);
        water[y * cols + x] -= amount * (1 - q) * Math.exp(-q);
      }
    }
    wake();
  }

  // Under a held finger the surface stays open, so the photo can be looked at.
  function press(cx, cy, radius) {
    const reachY = Math.ceil(radius * cw / ch);
    for (let y = Math.max(0, Math.floor(cy - reachY)); y <= Math.min(rows - 1, Math.ceil(cy + reachY)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(cols - 1, Math.ceil(cx + radius)); x++) {
        const d = Math.hypot(x - cx, (y - cy) * ch / cw) / radius;
        if (d < 1) energy[y * cols + x] = Math.max(energy[y * cols + x], 0.5 * (1 - d * d) + REVEAL);
      }
    }
  }

  function simulate() {
    let peak = 0;
    for (let y = 1; y < rows - 1; y++) for (let x = 1, i = y * cols + 1; x < cols - 1; x++, i++) {
      const c = water[i];
      // Cells are taller than wide, so the vertical term is scaled to keep rings round.
      previous[i] = (2 * c - previous[i] + TENSION * ((water[i - 1] + water[i + 1] - 2 * c) + squash * (water[i - cols] + water[i + cols] - 2 * c))) * DAMP * shore[i];
    }
    [water, previous] = [previous, water];
    for (let i = 0; i < energy.length; i++) {
      energy[i] = Math.max(energy[i] * FADE, Math.abs(water[i]));
      if (energy[i] > peak) peak = energy[i];
    }
    return peak;
  }

  function render() {
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const X = x * cw, Y = y * ch;
      if (full || energy[i] > REVEAL + jitter[i]) {
        if (shown[i]) { ctx.clearRect(X, Y, cw, ch); shown[i] = 0; }
        continue;
      }
      const inner = x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
      const dx = inner ? clamp(Math.round((water[i + 1] - water[i - 1]) * cw * 1.6), -cw, cw) : 0;
      const dy = inner ? clamp(Math.round((water[i + cols] - water[i - cols]) * ch * 1.6), -ch, ch) : 0;
      if (dx || dy) {
        ctx.drawImage(sheet, clamp(X + dx, 0, W - cw), clamp(Y + dy, 0, H - ch), cw, ch, X, Y, cw, ch);
        shown[i] = 2;
      } else if (shown[i] !== 1) {
        ctx.drawImage(sheet, X, Y, cw, ch, X, Y, cw, ch);
        shown[i] = 1;
      }
    }
  }

  function frame(t) {
    spare += Math.min(50, prev ? t - prev : STEP);
    prev = t;
    let peak = 1;
    while (spare >= STEP) {
      peak = simulate();
      spare -= STEP;
      if (held && last) {
        press(last[0], last[1], 20);
        if (++ticks % 16 === 0) drop(last[0], last[1], 0.8, 3);
      }
    }
    render();
    if (peak < 0.02 && !held) {
      water.fill(0); previous.fill(0); energy.fill(0);
      render();
      raf = 0; prev = 0; spare = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  function setFull(on) {
    full = on;
    btn.setAttribute('aria-pressed', String(on));
    if (ready) render();
  }

  function build() {
    const box = btn.getBoundingClientRect();
    if (!box.width || !img.naturalWidth) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.width = Math.round(box.width * dpr);
    H = cv.height = Math.round(box.height * dpr);
    cw = Math.max(Math.round(3 * dpr), Math.round(W / 150));
    ch = Math.round(cw * 1.6);
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / ch);
    squash = (cw / ch) ** 2;

    const sample = document.createElement('canvas');
    sample.width = cols; sample.height = rows;
    const sx = sample.getContext('2d', { willReadFrequently: true });
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(img, 0, 0, W / cw, H / ch);
    let data;
    try { data = sx.getImageData(0, 0, cols, rows).data; } catch { cv.remove(); return; }

    sheet = document.createElement('canvas');
    sheet.width = W; sheet.height = H;
    const g = sheet.getContext('2d');
    g.fillStyle = '#0d0d0c';
    g.fillRect(0, 0, W, H);
    g.font = `500 ${ch * 0.94}px 'Funnel Sans', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#eeeae2';
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      // Quieten the foliage away from the face so the portrait reads first.
      const off = Math.hypot(((x + 0.5) * cw / W - 0.5) / 0.34, ((y + 0.5) * ch / H - 0.55) / 0.6);
      const v = Math.min(1, Math.pow(data[i * 4] / 255, 1.25) * clamp(1.4 - off * 0.95, 0.1, 1.05));
      const c = RAMP[Math.round(v * (RAMP.length - 1))];
      if (v < 0.05 || c === ' ') continue;
      g.globalAlpha = 0.55 + v * 0.45;
      g.fillText(c, (x + 0.5) * cw, (y + 0.5) * ch);
    }
    g.globalAlpha = 1;

    const size = cols * rows;
    water = new Float32Array(size); previous = new Float32Array(size); energy = new Float32Array(size);
    jitter = Float32Array.from({ length: size }, () => Math.random() * 0.05);
    // Soft edges absorb waves instead of bouncing them back across the portrait.
    shore = Float32Array.from({ length: size }, (_, i) => {
      const x = i % cols, y = (i - x) / cols, d = Math.min(x, cols - 1 - x, (Math.min(y, rows - 1 - y)) * ch / cw);
      return d < 12 ? 0.86 + 0.14 * d / 12 : 1;
    });
    shown = new Uint8Array(size).fill(1);
    ctx.drawImage(sheet, 0, 0);
    ready = true;
    if (full) render();
  }

  const cellAt = (e) => { const r = btn.getBoundingClientRect(); return [(e.clientX - r.left) * dpr / cw, (e.clientY - r.top) * dpr / ch]; };

  // Follow the path so a fast flick still leaves a continuous trail of drops.
  function trail(to) {
    if (!last) { last = to; drop(to[0], to[1], 0.9, 3); return; }
    const distance = Math.hypot(to[0] - last[0], (to[1] - last[1]) * ch / cw);
    if (distance < 3) return;
    const count = Math.min(8, Math.ceil(distance / 6));
    for (let n = 1; n <= count; n++) drop(last[0] + (to[0] - last[0]) * n / count, last[1] + (to[1] - last[1]) * n / count, 0.55, 2.4);
    last = to;
  }

  if (reduced) {
    // No moving water: hover or tap swaps directly to the photo.
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setFull(true); });
    btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setFull(false); });
    btn.addEventListener('click', (e) => { if (e.detail === 0 || !hoverable.matches) setFull(!full); });
  } else {
    btn.addEventListener('pointerenter', (e) => { if (ready && e.pointerType === 'mouse') { last = null; trail(cellAt(e)); } });
    btn.addEventListener('pointermove', (e) => { if (ready && (e.pointerType === 'mouse' || held)) trail(cellAt(e)); });
    btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') last = null; });
    let pointer = '';
    btn.addEventListener('pointerdown', (e) => {
      pointer = e.pointerType;
      if (!ready || e.pointerType === 'mouse') return;
      touched = true; held = true; last = cellAt(e);
      drop(last[0], last[1], 1.1, 3.4);
    });
    const release = () => { held = false; last = null; };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    // Keyboard, mouse and voice control toggle the photo. Touch holds it instead.
    btn.addEventListener('click', (e) => { if (e.detail === 0 || pointer !== 'touch') setFull(!full); pointer = ''; });

    // Touch has no hover, so one drop falls when the portrait comes into view, as an invitation.
    if (!hoverable.matches) {
      const seen = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        seen.disconnect();
        setTimeout(() => { if (ready && !touched) drop(cols / 2, rows * 0.55, 1.2, 3.6); }, 450);
      }, { threshold: 0.6 });
      seen.observe(btn);
    }
  }

  let width = 0;
  const resize = () => { const w = btn.clientWidth; if (w !== width) { width = w; build(); } };
  // The photo is preloaded. The character art is built once the name has settled, so it doesn't
  // make the name stutter, or straight away when someone heads for About first.
  const loaded = img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }));
  const near = new Promise((r) => {
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { io.disconnect(); r(); } }, { rootMargin: '100% 0px' });
    io.observe(btn);
  });
  Promise.all([loaded, document.fonts.ready, Promise.race([heroDone, near])]).then(() => { new ResizeObserver(resize).observe(btn); });
})();

document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((link) => {
  const el = document.querySelector(link.getAttribute('href'));
  el.tabIndex = -1;
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    goToSection(el, !reduced && e.detail > 0);
  });
});
