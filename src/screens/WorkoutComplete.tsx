import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { ExerciseBreakdown } from '../components/ExerciseBreakdown';
import type { WorkoutSession } from '../types';

interface WorkoutCompleteProps {
  session: WorkoutSession;
  onDismiss: () => void;
}

// Canvas confetti
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#2bee79', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c'];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
      shape: 'rect' | 'circle';
    }

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 120;

    // Launch in bursts from multiple points
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const originX = canvas.width * (0.2 + Math.random() * 0.6);
      particles.push({
        x: originX,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 12,
        vy: -(8 + Math.random() * 14),
        w: 4 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 1,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      });
    }

    let animFrame: number;
    let frameCount = 0;
    const gravity = 0.25;
    const friction = 0.99;

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      frameCount++;

      let alive = 0;
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= friction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Start fading after peak
        if (frameCount > 40) {
          p.opacity = Math.max(0, p.opacity - 0.008);
        }

        if (p.opacity <= 0) continue;
        alive++;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }

      if (alive > 0 && frameCount < 300) {
        animFrame = requestAnimationFrame(animate);
      }
    }

    // Stagger start for burst effect
    animFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      class="fixed inset-0 z-[200] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div class={`bg-surface-dark rounded-xl p-4 border border-white/5 text-center transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <Icon name={icon} class={`text-2xl mb-2 ${color}`} />
      <p class="text-2xl font-bold text-white mb-1">{value}</p>
      <p class="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function WorkoutComplete({ session, onDismiss }: WorkoutCompleteProps) {
  const [showContent, setShowContent] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 200);
    const t2 = setTimeout(() => setShowStats(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Compute stats
  const duration = formatDuration(session.durationSeconds);
  const exerciseCount = session.exercises.length;
  const completedSets = session.totalSets;
  const totalReps = session.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((r, s) => r + (s.reps || 0), 0), 0);
  const volume = session.totalVolume;
  const muscleGroups = [...new Set(session.exercises.map(e => e.muscleGroup))];

  // Pick a motivational message
  const messages = [
    'Beast mode activated!',
    'Absolutely crushed it!',
    'New levels unlocked!',
    'That was legendary!',
    'Gains incoming!',
    'You showed up and delivered!',
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  return (
    <div class="fixed inset-0 z-[150] bg-bg-dark flex flex-col">
      <Confetti />

      <div class="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center px-6 py-10">
        {/* Trophy / check animation */}
        <div class={`transition-all duration-700 ease-out ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div class="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6 mx-auto border-2 border-primary/40">
            <Icon name="emoji_events" class="text-primary text-5xl" />
          </div>
        </div>

        <div class={`text-center mb-8 transition-all duration-500 delay-300 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h1 class="text-3xl font-bold text-white mb-2">Workout Complete!</h1>
          <p class="text-primary font-semibold text-lg">{message}</p>
          <p class="text-slate-400 text-sm mt-2">{session.name}</p>
        </div>

        {/* Stats grid */}
        <div class={`w-full max-w-[400px] transition-all duration-500 ${showStats ? 'opacity-100' : 'opacity-0'}`}>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <StatCard icon="schedule" label="Duration" value={duration} color="text-primary" />
            <StatCard icon="fitness_center" label="Exercises" value={`${exerciseCount}`} color="text-blue-400" />
            <StatCard icon="repeat" label="Sets" value={`${completedSets}`} color="text-amber-400" />
            <StatCard icon="tag" label="Total Reps" value={`${totalReps}`} color="text-rose-400" />
          </div>

          {volume > 0 && (
            <div class={`bg-surface-dark rounded-xl p-4 border border-primary/20 mb-4 text-center transition-all duration-500 delay-200 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div class="flex items-center justify-center gap-2 mb-1">
                <Icon name="monitoring" class="text-primary text-xl" />
                <span class="text-xs text-slate-400 uppercase tracking-wider">Total Volume</span>
              </div>
              <p class="text-3xl font-bold text-primary">{volume.toLocaleString()}<span class="text-lg text-slate-400 ml-1">lbs</span></p>
            </div>
          )}

          {/* Muscles worked */}
          <div class={`bg-surface-dark rounded-xl p-4 border border-white/5 mb-6 transition-all duration-500 delay-300 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p class="text-xs text-slate-400 uppercase tracking-wider mb-3 text-center">Muscles Worked</p>
            <div class="flex flex-wrap justify-center gap-2">
              {muscleGroups.map((mg) => (
                <span key={mg} class="text-xs text-slate-200 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
                  {mg}
                </span>
              ))}
            </div>
          </div>

          {/* Exercise breakdown */}
          <div class={`bg-surface-dark rounded-xl border border-white/5 overflow-hidden mb-6 transition-all duration-500 delay-400 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div class="p-3 border-b border-white/5">
              <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Exercise Breakdown</p>
            </div>
            <ExerciseBreakdown exercises={session.exercises} />
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div class="px-6 pb-8 pt-2">
        <button
          onClick={onDismiss}
          class="w-full h-14 rounded-xl bg-primary text-bg-dark font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          <Icon name="arrow_forward" class="text-2xl" />
          Continue
        </button>
      </div>
    </div>
  );
}
