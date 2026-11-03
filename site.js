// TCG Portfolio site script (defer): html.js flag, reveal-on-scroll, mobile menu, screen-kit charts.
document.documentElement.classList.add('js');

// Reveal: the page's one motion. Fade + 16px rise once an element enters the viewport (CSS does the move).
// Without IntersectionObserver, or with reduced motion, everything shows at once.
(() => {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
})();

// Mobile menu: the button toggles data-open on the nav; Escape closes it and returns focus.
(() => {
  const nav = document.querySelector('.nav');
  const btn = nav && nav.querySelector('.nav-toggle');
  if (!btn) return;
  // DOM order = tab order: put the button before the links it opens (CSS order keeps it beside the pill).
  nav.querySelector('.nav-links').before(btn);
  const set = open => { nav.toggleAttribute('data-open', open); btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  btn.addEventListener('click', () => set(!nav.hasAttribute('data-open')));
  nav.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.hasAttribute('data-open')) { set(false); btn.focus(); } });
  nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => set(false)));
})();

// Screen-kit charts: <svg class="chart" data-points="[oldest..newest]" data-fill="0|1"> inside a .phone or .lift.
// Ported from tcg-portfolio-ui chart/geometry.ts + Chart.tsx (monotone cubic, 64 samples, 12% headroom).
(() => {
  const charts = document.querySelectorAll('svg.chart[data-points]');
  if (!charts.length) return;
  const W = 430, H = 200, LEFT = 6, RIGHT = 14, TOP = 12, BOTTOM = 192, HEADROOM = 1.12, SAMPLES = 64;
  const BRAND = 'hsl(244 54% 81%)', DIVIDER = 'hsla(0,0%,100%,.08)', BG = 'hsl(60 5% 4%)';
  // Fritsch-Carlson tangents: the curve never overshoots the real min or max.
  const tangents = (xs, ys) => {
    const n = xs.length, s = [];
    for (let i = 0; i < n - 1; i++) s.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const t = [s[0]];
    for (let i = 1; i < n - 1; i++) t.push(s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2);
    t.push(s[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (s[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / s[i], b = t[i + 1] / s[i], l = a * a + b * b;
      if (l > 9) { const k = 3 / Math.sqrt(l); t[i] = k * a * s[i]; t[i + 1] = k * b * s[i]; }
    }
    return t;
  };
  const resample = ys => {
    const tg = tangents(ys.map((_, i) => i), ys), out = [];
    for (let j = 0; j < SAMPLES; j++) {
      const idx = (j / (SAMPLES - 1)) * (ys.length - 1), i = Math.min(ys.length - 2, Math.floor(idx)), t = idx - i;
      out.push(ys[i] + (ys[i + 1] - ys[i]) * (3 * t * t - 2 * t * t * t) + (t * t * t - 2 * t * t + t) * tg[i] + (t * t * t - t * t) * tg[i + 1]);
    }
    return out;
  };
  const linePath = (xs, ys) => {
    const tg = tangents(xs, ys);
    let p = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const d = (xs[i + 1] - xs[i]) / 3;
      p += ` C${(xs[i] + d).toFixed(1)},${(ys[i] + tg[i] * d).toFixed(1)} ${(xs[i + 1] - d).toFixed(1)},${(ys[i + 1] - tg[i + 1] * d).toFixed(1)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`;
    }
    return p;
  };
  charts.forEach((svg, k) => {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let raw = [];
    try { raw = JSON.parse(svg.dataset.points); } catch (e) { /* bad data: grid only */ }
    let html = [.25, .5, .75].map(f => BOTTOM - f * (BOTTOM - TOP))
      .map(y => `<line x1="${LEFT}" x2="${W - RIGHT + 4}" y1="${y}" y2="${y}" stroke="${DIVIDER}" stroke-dasharray="2 4"/>`).join('')
      + `<line x1="${LEFT}" x2="${W - RIGHT + 4}" y1="${H - .5}" y2="${H - .5}" stroke="${DIVIDER}"/>`;
    if (raw.length >= 2) {
      const s = resample(raw), min = Math.min(...s), max = Math.max(...s), span = (max - min) * HEADROOM;
      const xs = s.map((_, i) => LEFT + (i * (W - LEFT - RIGHT)) / (s.length - 1));
      const ys = s.map(v => (max === min ? (TOP + BOTTOM) / 2 : BOTTOM - ((v - min) / span) * (BOTTOM - TOP)));
      const line = linePath(xs, ys), area = `${line} L${xs.at(-1).toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
      if (svg.dataset.fill === '1') html += `<defs><pattern id="dots${k}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="${BRAND}"/></pattern>`
        + `<linearGradient id="fs${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<mask id="fade${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fs${k})"/></mask></defs>`
        + `<path d="${area}" fill="url(#dots${k})" mask="url(#fade${k})"/><path d="${area}" fill="${BRAND}" fill-opacity=".06"/>`;
      html += `<path d="${line}" fill="none" stroke="${BRAND}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`
        + `<circle cx="${xs.at(-1)}" cy="${ys.at(-1)}" r="5" fill="${BRAND}" stroke="${BG}" stroke-width="2"/>`;
    }
    svg.innerHTML = html;
  });
})();
