import { useRef, useEffect } from "react";

const CONNECTION_DIST = 150;
const INTERACT_DIST = 250;

function createParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    baseX: 0,
    baseY: 0,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: Math.random() * 2 + 1,
  };
}

function initParticle(p) {
  p.baseX = p.x;
  p.baseY = p.y;
  return p;
}

function updateParticle(p, w, h, mx, my) {
  p.baseX += p.vx;
  p.baseY += p.vy;
  if (p.baseX < 0 || p.baseX > w) p.vx *= -1;
  if (p.baseY < 0 || p.baseY > h) p.vy *= -1;
  p.x = p.baseX;
  p.y = p.baseY;

  const dx = mx - p.x;
  const dy = my - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < INTERACT_DIST && dist > 0) {
    const force = (INTERACT_DIST - dist) / INTERACT_DIST;
    p.x -= (dx / dist) * force * 15;
    p.y -= (dy / dist) * force * 15;
  }
}

function drawParticle(ctx, p) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(155, 106, 255, 0.6)";
  ctx.fill();
}

/**
 * Neuron/neural-network background canvas animation.
 * Particles drift, repel from the mouse cursor, and draw
 * connection lines between nearby particles and the cursor.
 */
export default function NeuronCanvas() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef([]);
  const animRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = { w, h };
      const count = Math.floor((w * h) / 18000);
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push(initParticle(createParticle(w, h)));
      }
      particlesRef.current = arr;
    };

    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const animate = () => {
      const { w, h } = sizeRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const pts = particlesRef.current;

      ctx.clearRect(0, 0, w, h);
      pts.forEach((p) => updateParticle(p, w, h, mx, my));

      // connections between particles
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECTION_DIST) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(155, 106, 255, ${(1 - d / CONNECTION_DIST) * 0.25})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        // connections to mouse
        const dxm = pts[i].x - mx;
        const dym = pts[i].y - my;
        const dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < INTERACT_DIST * 0.8) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(65, 161, 255, ${(1 - dm / (INTERACT_DIST * 0.8)) * 0.45})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      pts.forEach((p) => drawParticle(ctx, p));
      animRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
