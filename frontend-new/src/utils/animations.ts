export const celebrateBurst = (x?: number, y?: number) => {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  const centerX = (x ?? window.innerWidth / 2) * DPR;
  const centerY = (y ?? window.innerHeight * 0.45) * DPR;

  const particles = Array.from({ length: 200 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4;
    return {
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed * DPR,
      vy: Math.sin(angle) * speed * DPR - 3 * DPR,
      g: 0.3 * DPR,
      life: Math.random() * 60 + 40,
      maxLife: Math.random() * 60 + 40,
      color: `hsl(${Math.random() * 360}, 90%, 60%)`,
      r: Math.random() * 4 * DPR + 2 * DPR,
      trail: [] as Array<{ x: number; y: number }>,
    };
  });

  let animId: number;
  const animate = () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 10) p.trail.shift();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.r / 2;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        if (i === 0) ctx.moveTo(t.x, t.y);
        else ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 15 * DPR;
      ctx.shadowColor = p.color;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= 0.99;
      p.life--;
    }

    if (particles.some(p => p.life > 0)) {
      animId = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animId);
      canvas.remove();
    }
  };

  animate();
};

export const initTiltEffect = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const cards = document.querySelectorAll<HTMLElement>('[data-tilt]');
  const MAX_TILT = 10;

  cards.forEach(card => {
    let rect: DOMRect | null = null;

    const onMove = (e: Event) => {
      const pointerEvent = e as PointerEvent;
      rect = rect || card.getBoundingClientRect();
      const x = (pointerEvent.clientX - rect.left) / rect.width;
      const y = (pointerEvent.clientY - rect.top) / rect.height;
      const rx = (0.5 - y) * MAX_TILT;
      const ry = (x - 0.5) * MAX_TILT;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    };

    const onLeave = () => {
      card.style.transform = 'none';
      rect = null;
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
  });
};

// Кровавая вспышка при уроне (красный screen flash + дрожь)
export const damageFlash = (intensity = 1) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;pointer-events:none;z-index:9998',
    'background:radial-gradient(circle at center, transparent 30%, rgba(180,0,0,0.6) 100%)',
    `opacity:${0.8 * intensity};transition:opacity 0.5s ease-out`,
  ].join(';');
  document.body.appendChild(overlay);

  const root = document.documentElement;
  const prevTransform = root.style.transform;
  let t = 0;
  const shakeId = window.setInterval(() => {
    const dx = (Math.random() - 0.5) * 12 * intensity;
    const dy = (Math.random() - 0.5) * 12 * intensity;
    root.style.transform = `translate(${dx}px, ${dy}px)`;
    t++;
    if (t > 8) {
      clearInterval(shakeId);
      root.style.transform = prevTransform;
    }
  }, 40);

  requestAnimationFrame(() => { overlay.style.opacity = '0'; });
  setTimeout(() => overlay.remove(), 600);
};

// Золотой пульс при level-up + поднимающиеся символы
export const levelUpEffect = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  const symbols = ['⭐', '✨', '⚡', '🌟', '💫'];
  const items = Array.from({ length: 24 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height + 40 * DPR,
    vy: -(Math.random() * 4 + 3) * DPR,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.1,
    size: (Math.random() * 28 + 22) * DPR,
    sym: symbols[Math.floor(Math.random() * symbols.length)],
    life: 120,
  }));

  let id: number;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const it of items) {
      if (it.life <= 0) continue;
      alive = true;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.globalAlpha = Math.min(1, it.life / 60);
      ctx.font = `${it.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 20 * DPR;
      ctx.fillText(it.sym, 0, 0);
      ctx.restore();
      it.x += (Math.random() - 0.5) * 1.5;
      it.y += it.vy;
      it.vy *= 0.99;
      it.rot += it.vrot;
      it.life--;
    }
    if (alive) id = requestAnimationFrame(draw);
    else { cancelAnimationFrame(id); canvas.remove(); }
  };
  draw();
};

// Зелёная вспышка-аура при использовании зелья / лечении
export const healPulse = (x?: number, y?: number) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ring = document.createElement('div');
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight / 2;
  ring.style.cssText = [
    'position:fixed;pointer-events:none;z-index:9999',
    `left:${cx - 20}px;top:${cy - 20}px;width:40px;height:40px`,
    'border-radius:50%;border:3px solid #4ade80',
    'box-shadow:0 0 40px #22c55e, inset 0 0 20px #4ade80',
    'transition:transform 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease-out',
    'transform:scale(1);opacity:1',
  ].join(';');
  document.body.appendChild(ring);
  requestAnimationFrame(() => {
    ring.style.transform = 'scale(15)';
    ring.style.opacity = '0';
  });
  setTimeout(() => ring.remove(), 800);
};

// Тёмный портал при критическом событии (некромантия / смерть врага)
export const darkPortal = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const portal = document.createElement('div');
  portal.style.cssText = [
    'position:fixed;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:9998',
    'transform:translate(-50%,-50%);border-radius:50%',
    'background:radial-gradient(circle, #6d28d9 0%, #1e1b4b 40%, transparent 70%)',
    'box-shadow:0 0 80px #7c3aed, inset 0 0 60px #000',
    'transition:width 0.4s ease-out, height 0.4s ease-out, opacity 0.6s ease-in 0.4s',
    'opacity:1',
  ].join(';');
  document.body.appendChild(portal);
  requestAnimationFrame(() => {
    portal.style.width = '500px';
    portal.style.height = '500px';
    setTimeout(() => { portal.style.opacity = '0'; }, 400);
  });
  setTimeout(() => portal.remove(), 1100);
};

export const initRevealAnimation = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll<HTMLElement>('.reveal-item');

  if (prefersReduced) {
    targets.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
  );

  targets.forEach(el => observer.observe(el));
};
