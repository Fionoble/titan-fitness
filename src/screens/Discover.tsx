import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { getStyleInfo } from '../workout-engine';
import type { Equipment, WorkoutStyle } from '../types';

interface DiscoverProps {
  equipment: Equipment[];
  onSelectStyle: (style: string) => void;
}

const ALL_STYLES: WorkoutStyle[] = ['strength', 'hypertrophy', 'functional', 'hiit', 'cardio', 'recovery', 'mobility', 'power', 'endurance'];
const FILTERS = ['All', 'Recommended', 'New', 'Favorites'];

const STYLE_IMAGES: Record<WorkoutStyle, string> = {
  strength: 'linear-gradient(135deg, #1a3a2a 0%, #0d2218 100%)',
  hypertrophy: 'linear-gradient(135deg, #2a1a3a 0%, #18102a 100%)',
  functional: 'linear-gradient(135deg, #1a2a3a 0%, #0d1828 100%)',
  hiit: 'linear-gradient(135deg, #3a2a1a 0%, #281d0d 100%)',
  cardio: 'linear-gradient(135deg, #3a1a1a 0%, #280d0d 100%)',
  recovery: 'linear-gradient(135deg, #2a1a3a 0%, #1d0d28 100%)',
  mobility: 'linear-gradient(135deg, #1a3a3a 0%, #0d2828 100%)',
  power: 'linear-gradient(135deg, #3a3a1a 0%, #28280d 100%)',
  endurance: 'linear-gradient(135deg, #3a1a2a 0%, #280d1d 100%)',
};

export function Discover({ equipment, onSelectStyle }: DiscoverProps) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  const enabledEquipment = equipment.filter((e) => e.enabled);
  const filteredStyles = ALL_STYLES.filter((s) => {
    if (search) {
      const info = getStyleInfo(s);
      return info.label.toLowerCase().includes(search.toLowerCase()) ||
             info.description.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  // Pick a "top pick" style
  const topPick = filteredStyles[Math.floor(new Date().getDate() % filteredStyles.length)] || 'strength';
  const topPickInfo = getStyleInfo(topPick);

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <header class="sticky top-0 z-20 bg-bg-dark/95 backdrop-blur-sm px-4 pt-6 pb-2">
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1">
            <p class="text-sm font-medium text-slate-400">Explore workouts</p>
            <h1 class="text-2xl font-bold tracking-tight text-white">Workout Styles</h1>
          </div>
        </div>

        {/* Search */}
        <div class="flex w-full items-center rounded-xl bg-surface-dark border border-white/5 focus-within:border-primary transition-colors h-12 mb-4">
          <div class="flex items-center justify-center pl-4 text-slate-500">
            <Icon name="search" class="text-2xl" />
          </div>
          <input
            type="text"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            class="flex w-full min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-white placeholder-slate-500 focus:outline-0 border-none ring-0 focus:ring-0"
            placeholder="Find routines, equipment, or muscles..."
          />
        </div>

        {/* Filters */}
        <div class="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              class={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 transition-all active:scale-95 ${
                activeFilter === f
                  ? 'bg-primary text-bg-dark font-semibold'
                  : 'bg-surface-dark border border-white/5 hover:border-primary/50 text-slate-200 font-medium'
              } text-sm`}
            >
              {f === 'Recommended' && <Icon name="auto_awesome" class="text-[18px]" />}
              {f}
            </button>
          ))}
        </div>
      </header>

      <main class="px-4 py-2 pb-24 space-y-6">
        {/* Top Pick */}
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="bolt" class="text-primary" />
              Top Pick for You
            </h2>
          </div>
          <button
            onClick={() => onSelectStyle(topPick)}
            class="relative h-64 w-full overflow-hidden rounded-2xl group cursor-pointer shadow-lg shadow-black/20 text-left"
          >
            <div class="absolute inset-0" style={{ background: STYLE_IMAGES[topPick] }}></div>
            <div class="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent"></div>
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center rounded-lg bg-primary/90 px-2.5 py-1 text-xs font-bold text-bg-dark backdrop-blur-md">
                Best Match
              </span>
            </div>
            <div class="absolute bottom-0 left-0 w-full p-5">
              <p class="text-primary text-xs font-bold uppercase tracking-wider mb-1">{topPickInfo.label}</p>
              <h3 class="text-2xl font-bold text-white mb-2 leading-tight">
                {topPickInfo.label} Training
              </h3>
              <p class="text-slate-300 text-sm mb-2">{topPickInfo.description}</p>
              <div class="flex items-center gap-3 text-slate-300 text-xs font-medium">
                <span class="flex items-center gap-1">
                  <Icon name="timer" class="text-[16px]" /> 30-50 min
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="fitness_center" class="text-[16px]" /> {enabledEquipment.length} equip
                </span>
              </div>
            </div>
          </button>
        </section>

        {/* Browse Styles */}
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-white">Browse Styles</h2>
          </div>
          <div class="grid grid-cols-1 gap-4">
            {filteredStyles.filter((s) => s !== topPick).map((style, i) => {
              const info = getStyleInfo(style);
              const isRight = i % 2 === 1;
              return (
                <button
                  key={style}
                  onClick={() => onSelectStyle(style)}
                  class="relative h-44 w-full overflow-hidden rounded-2xl group cursor-pointer shadow-md shadow-black/20 text-left"
                >
                  <div class="absolute inset-0" style={{ background: STYLE_IMAGES[style] }}></div>
                  <div class={`absolute inset-0 bg-gradient-to-${isRight ? 'l' : 'r'} from-bg-dark/90 via-bg-dark/40 to-transparent`}></div>
                  <div class={`absolute inset-0 p-5 flex flex-col justify-end ${isRight ? 'items-end text-right' : 'items-start'}`}>
                    <div class="bg-surface-dark/30 backdrop-blur-sm p-1.5 rounded-lg mb-2 inline-block">
                      <Icon name={info.icon} class="text-primary block" />
                    </div>
                    <h3 class="text-xl font-bold text-white mb-1">{info.label}</h3>
                    <p class="text-slate-300 text-sm line-clamp-1">{info.description}</p>
                  </div>
                  <div class={`absolute top-4 ${isRight ? 'left-4' : 'right-4'} bg-black/40 backdrop-blur-md rounded-full px-3 py-1`}>
                    <span class="text-xs font-medium text-white" style={{ color: info.color }}>
                      <Icon name={info.icon} class="text-[14px] mr-1" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
