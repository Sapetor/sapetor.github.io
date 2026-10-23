// Home-page platoon strip. Simulates a predecessor-following platoon with a
// constant time-headway policy (double integrator + first-order actuator lag):
//   u_i = kp * (x_{i-1} - x_i - r - h v_i) + kd * (v_{i-1} - v_i)
// The spacing-error transfer function has peak gain 1, so each follower's
// speed dip is smaller than its predecessor's. Brake lights show deceleration.
(function () {
  const canvas = document.getElementById("platoon-strip");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const N = 8, kp = 0.6, kd = 1.2, h = 1.0, tau = 0.2, r = 6.0, v0 = 20.0;
  const dt = 0.01, period = 16.0;
  let x, v, a, t, peak;

  function reset() {
    x = []; v = []; a = []; peak = [];
    for (let i = 0; i < N; i++) { x.push(-i * (r + h * v0)); v.push(v0); a.push(0); peak.push(0); }
    t = 0;
  }

  // The leader slows down, then speeds up by the same profile, so it returns to
  // its nominal position every period and the platoon stays on screen.
  function leaderSpeed(tc) {
    const s = tc % period;
    if (s >= 2 && s <= 8) return v0 - 4.0 * Math.sin((Math.PI * (s - 2)) / 6) ** 2;
    if (s >= 9 && s <= 15) return v0 + 4.0 * Math.sin((Math.PI * (s - 9)) / 6) ** 2;
    return v0;
  }

  function step() {
    const u = new Array(N);
    u[0] = 3.0 * (leaderSpeed(t) - v[0]);
    for (let i = 1; i < N; i++) {
      u[i] = kp * (x[i - 1] - x[i] - (r + h * v[i])) + kd * (v[i - 1] - v[i]);
    }
    // peak[i] holds vehicle i's largest speed drop in the current slow-down wave;
    // it resets once the vehicle is clearly faster than cruising speed again.
    for (let i = 0; i < N; i++) {
      a[i] += (dt * (u[i] - a[i])) / tau;
      v[i] += dt * a[i];
      x[i] += dt * v[i];
      const dv = v[i] - v0;
      if (dv > 0.3) peak[i] = 0;
      else if (dv < 0) peak[i] = Math.max(peak[i], -dv);
    }
    t += dt;
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, hgt = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);

    const road = hgt - 10;
    ctx.strokeStyle = css("--global-divider-color") || "#d8e0eb";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, road + 0.5); ctx.lineTo(w, road + 0.5); ctx.stroke();

    // Co-moving frame: nominal leader position at speed v0 stays fixed on screen.
    const carW = Math.max(18, Math.min(44, w / 26)), carH = carW * 0.42;
    const span = (N - 1) * (r + h * v0);
    const scale = (w - 2 * carW - 24) / span;
    const ref = v0 * t;
    const body = css("--global-theme-color") || "#1f4e9a";
    const barMax = road - carH - 18, barW = Math.max(3, carW * 0.16);

    for (let i = 0; i < N; i++) {
      const px = w - 12 - (ref - x[i]) * scale;
      // Speed-deviation bar: amber while slower than cruising speed, blue while faster.
      const dv = v[i] - v0;
      const bh = Math.min(1, Math.abs(dv) / 4.0) * barMax;
      if (bh > 0.5) {
        ctx.fillStyle = dv < 0 ? "rgba(217, 142, 4, 0.85)" : body;
        ctx.globalAlpha = dv < 0 ? 1 : 0.35;
        ctx.fillRect(px - carW / 2 - barW / 2, road - carH - 8 - bh, barW, bh);
        ctx.globalAlpha = 1;
      }
      // Tick at the largest speed drop so far in this slow-down wave.
      const ph = Math.min(1, peak[i] / 4.0) * barMax;
      if (ph > 1) {
        ctx.fillStyle = css("--global-text-color-light") || "#5b6b82";
        ctx.fillRect(px - carW / 2 - barW * 1.5, road - carH - 8 - ph - 1, barW * 3, 2);
      }
      ctx.fillStyle = body;
      ctx.globalAlpha = i === 0 ? 1 : 0.82;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px - carW, road - carH - 3, carW, carH, 3);
      else ctx.rect(px - carW, road - carH - 3, carW, carH);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Brake light: intensity grows with deceleration.
      const brake = Math.max(0, Math.min(1, -a[i] / 2.0));
      if (brake > 0.03) {
        ctx.fillStyle = "rgba(217, 142, 4," + brake.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(px - carW - 2, road - carH / 2 - 3, 2.5 + 3 * brake, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = css("--global-text-color-light") || "#5b6b82";
      ctx.beginPath(); ctx.arc(px - carW * 0.75, road - 2, 2, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(px - carW * 0.25, road - 2, 2, 0, 2 * Math.PI); ctx.fill();
    }
  }

  reset();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) {
    // Static frame mid-manoeuvre so the brake-light gradient is still visible.
    while (t < 7.5) step();
    draw();
    window.addEventListener("resize", draw);
    return;
  }

  let last = null, visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
  function frame(ts) {
    if (last === null) last = ts;
    let elapsed = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    if (visible && !document.hidden) {
      while (elapsed > 0) { step(); elapsed -= dt; }
      if (t > period * 50) reset();
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
