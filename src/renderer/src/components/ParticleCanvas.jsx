import { useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

/**
 * @param {Object} trigger - An object containing { x, y, width, height } of the element to "disintegrate"
 */
const ParticleCanvas = ({ trigger }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animationRef = useRef(null);

  const createParticles = (x, y, width, height) => {
    const count = 1200; // Particle density
    const colors = ["#94a3b8", "#6366f1", "#475569", "#334155"]; // Ash/Dust colors

    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
        // vx: -3 to -1 moves particles Right to Left
        vx: -(Math.random() * 1.5 + 0.5),
        vy: Math.random() * 1.5 - 1.2,
        life: 1.0,
        size: 0.4 + Math.random() * 1.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
        turbulence: Math.random() * 0.1,
        angle: Math.random() * Math.PI * 2,
      });
    }
  };

  useEffect(() => {
    if (trigger) {
      createParticles(trigger.x, trigger.y, trigger.width, trigger.height);
    }
  }, [trigger]);

  const update = useCallback(function updateFrame() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    particles.current = particles.current.filter((p) => p.life > 0);

    particles.current.forEach((p) => {
      p.angle += p.turbulence * 0.5;
      p.x += p.vx + Math.cos(p.angle) * 0.3;
      p.y += p.vy + Math.sin(p.angle) * 0.3;

      p.life -= 0.006; // Controls speed of fade (smaller = slower)
      p.opacity = p.life;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(updateFrame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);
    resize();
    update();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [update]);

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
