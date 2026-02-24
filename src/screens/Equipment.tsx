import { useState, useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { Equipment as EquipmentType } from '../types';

interface EquipmentProps {
  equipment: EquipmentType[];
  onToggle: (id: string) => void;
}

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  weights: { label: 'Weights', icon: 'weight' },
  cardio: { label: 'Cardio', icon: 'monitor_heart' },
  recovery: { label: 'Recovery & Gear', icon: 'self_improvement' },
  other: { label: 'Other', icon: 'category' },
};

export function EquipmentScreen({ equipment, onToggle }: EquipmentProps) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = search
      ? equipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
      : equipment;

    const groups: Record<string, EquipmentType[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [equipment, search]);

  const enabledCount = equipment.filter((e) => e.enabled).length;

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-4">
      {/* Header */}
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="flex items-center justify-between px-4 py-4">
          <div></div>
          <h1 class="text-lg font-bold tracking-tight">My Equipment</h1>
          <span class="text-primary text-sm font-semibold">{enabledCount} active</span>
        </div>
      </header>

      <main class="px-4 pb-8 space-y-6 pt-4">
        {/* Search */}
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="search" class="text-slate-500" />
          </div>
          <input
            type="text"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search equipment..."
            class="block w-full pl-10 pr-3 py-3 rounded-xl border-none bg-surface-dark text-white placeholder-slate-500 focus:ring-2 focus:ring-primary transition-all"
          />
        </div>

        {/* Info card */}
        <div class="p-4 rounded-2xl bg-gradient-to-br from-surface-dark to-bg-dark border border-white/5 relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 opacity-10">
            <Icon name="fitness_center" class="text-primary" size="80px" />
          </div>
          <h3 class="font-bold text-white text-lg mb-1 relative z-10">Your Home Gym</h3>
          <p class="text-sm text-slate-400 mb-1 relative z-10">
            Toggle your equipment to get personalized workout plans that use exactly what you have.
          </p>
        </div>

        {/* Equipment categories */}
        {Object.entries(CATEGORY_INFO).map(([catKey, catInfo]) => {
          const items = grouped[catKey];
          if (!items || items.length === 0) return null;

          return (
            <section key={catKey}>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <Icon name={catInfo.icon} class="text-primary" />
                  {catInfo.label}
                </h2>
                <span class="text-xs font-medium text-slate-500 bg-surface-dark px-2 py-1 rounded-full">
                  {items.filter((i) => i.enabled).length}/{items.length}
                </span>
              </div>
              <div class="space-y-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    class={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                      item.enabled
                        ? 'bg-surface-dark border-2 border-primary shadow-md'
                        : 'bg-surface-dark border border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div class="flex items-center gap-4">
                      <div class={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.enabled ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-500'
                      }`}>
                        <Icon name={item.icon} />
                      </div>
                      <div class="text-left">
                        <p class={`font-semibold ${item.enabled ? 'text-white' : 'text-slate-300'}`}>{item.name}</p>
                        <p class="text-xs text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    {/* Toggle */}
                    <div class={`w-11 h-6 rounded-full relative transition-colors ${
                      item.enabled ? 'bg-primary' : 'bg-slate-700'
                    }`}>
                      <div class={`absolute top-[2px] w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                        item.enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                      }`}></div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
