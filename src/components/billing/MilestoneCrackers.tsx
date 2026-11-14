import { useEffect, useRef } from 'react';

const COLORS = ['#fbbf24', '#fcd34d', '#f6f1e4', '#ffffff', '#1955da', '#f59e0b', '#fde68a'];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  kind: 'confetti' | 'spark';
};

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  exploded: boolean;
};

function explode(particles: Particle[], x: number, y: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 7.5;
    const spark = Math.random() < 0.28;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      w: spark ? 1.4 : 5 + Math.random() * 7,
      h: spark ? 8 + Math.random() * 10 : 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      kind: spark ? 'spark' : 'confetti',
    });
  }
}

export default function MilestoneCrackers({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [
      { x: canvas.width * 0.12, y: canvas.height * 0.92, vx: 3.2, vy: -13.5, exploded: false },
      { x: canvas.width * 0.88, y: canvas.height * 0.92, vx: -3.2, vy: -13.5, exploded: false },
      { x: canvas.width * 0.28, y: canvas.height * 0.96, vx: 1.4, vy: -12.2, exploded: false },
      { x: canvas.width * 0.72, y: canvas.height * 0.96, vx: -1.4, vy: -12.2, exploded: false },
    ];

    let frame = 0;
    let raf = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const rocket of rockets) {
        if (rocket.exploded) continue;
        rocket.x += rocket.vx;
        rocket.y += rocket.vy;
        rocket.vy += 0.22;
        ctx.save();
        ctx.translate(rocket.x, rocket.y);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-rocket.vx * 2.4, -rocket.vy * 2.4);
        ctx.stroke();
        ctx.restore();
        if (rocket.vy >= -1.2 || rocket.y < canvas.height * 0.22) {
          rocket.exploded = true;
          explode(particles, rocket.x, rocket.y, 70);
        }
      }

      if (frame === 28) {
        explode(particles, canvas.width * 0.5, canvas.height * 0.32, 90);
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.vy += p.kind === 'spark' ? 0.08 : 0.14;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.kind === 'spark' ? 0.018 : 0.008;
        if (p.life <= 0 || p.y > canvas.height + 40) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === 'spark') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      const allExploded = rockets.every((r) => r.exploded);
      if (allExploded && particles.length === 0 && frame > 40) {
        stopped = true;
        onDone();
        return;
      }
      if (frame > 280) {
        stopped = true;
        onDone();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[120]"
      aria-hidden
    />
  );
}
