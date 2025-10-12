// fx-always-on.js — permanent confetti animation (light CPU)
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("fx");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let w, h;
  const resize = () => { w = canvas.width = innerWidth; h = canvas.height = innerHeight; };
  resize();
  window.addEventListener("resize", resize);

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 4 + Math.random() * 4,
    c: ["#FFC72C", "#DA291C", "#F8D560", "#F39B96"][Math.floor(Math.random() * 4)],
    vx: -0.5 + Math.random(),
    vy: 1 + Math.random() * 2,
  }));

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
      ctx.fillStyle = p.c;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > h + 10) p.y = -10;
      if (p.x > w + 10) p.x = -10;
      if (p.x < -10) p.x = w + 10;
    });
    requestAnimationFrame(draw);
  }
  draw();
});
