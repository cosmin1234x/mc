// fx-sparkle.js — lightweight ambient sparkles (always on)
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("sparkle");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    w = canvas.clientWidth = innerWidth;
    h = canvas.clientHeight = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener("resize", resize);

  // Make 36–48 soft sparkles, biased around top bar & chat area
  const N = Math.round(36 + Math.random() * 12);
  const golds = ["#FFC72C", "#FFD964", "#FFE89B"];
  const reds  = ["#DA291C", "#E74A40"];
  const colors = [...golds, ...golds, ...reds]; // golds more common

  function spawn(i) {
    // bias X across width; bias Y toward top third (appbar/chat header)
    const x = Math.random() * w;
    const y = (Math.random() ** 1.6) * (h * 0.55);
    const r = 0.8 + Math.random() * 1.8;     // tiny dots
    const a = 0.18 + Math.random() * 0.25;   // alpha
    const c = colors[Math.floor(Math.random() * colors.length)];
    const vy = 0.12 + Math.random() * 0.35;  // gentle float
    const life = 4000 + Math.random() * 5000;
    const born = performance.now() - Math.random() * life;
    return { x, y, r, a, c, vy, life, born, seed:i };
  }

  const pts = Array.from({ length: N }, (_, i) => spawn(i));

  function easeInOutSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

  function tick(ts) {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const t = (ts - p.born) / p.life;
      if (t >= 1) { pts[i] = spawn(i); continue; }

      // vertical drift + tiny horizontal shimmer
      const x = p.x + Math.sin((t + p.seed) * 6.283) * 4; // subtle sway
      const y = p.y + p.vy * (t * 120);                   // slow rise

      // fade in/out curve
      const alpha = p.a * (t < 0.5 ? easeInOutSine(t * 2) : easeInOutSine((1 - t) * 2));

      // glow (two-pass: soft outer then crisp center)
      ctx.globalAlpha = alpha * 0.55;
      ctx.beginPath(); ctx.arc(x, y, p.r * 3.2, 0, Math.PI * 2); ctx.fillStyle = p.c; ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.c; ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  // Respect reduced motion
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mql.matches) return; // don’t animate for reduced motion

  requestAnimationFrame(tick);
});
