import { useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

/**
 * Dust burst played when a task is deleted.
 *
 * The loop only runs while there are particles alive — it used to hold a
 * requestAnimationFrame loop open forever, which kept the compositor busy
 * (~18% CPU) even when the app was sitting idle.
 */
const ParticleCanvas = ({ trigger }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animationRef = useRef(null);
  const runningRef = useRef(false);

  const frame = useCallback(function step() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) {
      runningRef.current = false;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.current = particles.current.filter((p) => p.life > 0);

    if (particles.current.length === 0) {
      runningRef.current = false;
      animationRef.current = null;
      return; // nothing left to draw: stop burning frames
    }

    particles.current.forEach((p) => {
      p.angle += p.turbulence * 0.5;
      p.x += p.vx + Math.cos(p.angle) * 0.3;
      p.y += p.vy + Math.sin(p.angle) * 0.3;
      p.life -= 0.006;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    animationRef.current = requestAnimationFrame(step);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    animationRef.current = requestAnimationFrame(frame);
  }, [frame]);

  useEffect(() => {
    if (!trigger) return;
    const { x, y, width, height } = trigger;
    const colors = ["#94a3b8", "#6366f1", "#475569", "#334155"];
    for (let i = 0; i < 900; i++) {
      particles.current.push({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
        vx: -(Math.random() * 1.5 + 0.5),
        vy: Math.random() * 1.5 - 1.2,
        life: 1,
        size: 0.4 + Math.random() * 1.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        turbulence: Math.random() * 0.1,
        angle: Math.random() * Math.PI * 2,
      });
    }
    start();
  }, [trigger, start]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      runningRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
};

ParticleCanvas.propTypes = {
  trigger: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    timestamp: PropTypes.number,
  }),
};

export default ParticleCanvas;
