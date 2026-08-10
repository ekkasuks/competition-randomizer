/*
 * fx.js — เอฟเฟกต์เสียงและคอนเฟตติ (ไม่ต้องใช้ไฟล์เสียงภายนอก)
 * สร้างเสียงด้วย Web Audio API และคอนเฟตติด้วย Canvas
 */

const FX = (() => {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setMuted(v) {
    muted = v;
  }
  function isMuted() {
    return muted;
  }

  /** โทนเดี่ยว */
  function tone(freq, start, dur, type, gain) {
    if (muted) return;
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** เสียง "ตึ๊ก" ตอนหมุนเปลี่ยนชื่อ */
  function tick() {
    if (muted) return;
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.07);
  }

  /** เสียงลุ้นระหว่างหมุน (riser) — คืนฟังก์ชันสำหรับหยุด */
  function riser(durationMs) {
    if (muted) return () => {};
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    const t0 = c.currentTime;
    const t1 = t0 + durationMs / 1000;
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(760, t1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.15);
    g.gain.setValueAtTime(0.12, t1 - 0.05);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t1 + 0.1);
    return () => {
      try {
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
        osc.stop(c.currentTime + 0.12);
      } catch (e) {
        /* ignore */
      }
    };
  }

  /** เสียงแฟนแฟร์ตอนเฉลยผล */
  function fanfare() {
    if (muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => tone(f, i * 0.11, 0.5, "triangle", 0.28));
    // เสียง sparkle
    tone(1568, 0.44, 0.6, "sine", 0.18);
    tone(2093, 0.5, 0.5, "sine", 0.12);
  }

  /* -------------------- คอนเฟตติ -------------------- */
  let confettiCanvas = null;
  let confettiCtx = null;
  let particles = [];
  let rafId = null;

  function ensureCanvas() {
    if (confettiCanvas) return;
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;";
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function confetti(count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ensureCanvas();
    const colors = ["#ffc53d", "#ff5d8f", "#38e1c6", "#7c9cff", "#ffffff"];
    const n = count || 160;
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * confettiCanvas.height * 0.3,
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 5,
        size: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
      });
    }
    if (!rafId) loop();
  }

  function loop() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += p.vr;
      p.life -= 0.004;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha = Math.max(0, p.life);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    });
    particles = particles.filter(
      (p) => p.life > 0 && p.y < confettiCanvas.height + 40
    );
    if (particles.length > 0) {
      rafId = requestAnimationFrame(loop);
    } else {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      rafId = null;
    }
  }

  return {
    setMuted,
    isMuted,
    tick,
    riser,
    fanfare,
    confetti,
    unlock: ac,
  };
})();
