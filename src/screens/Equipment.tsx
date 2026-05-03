import { useState, useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { Equipment as EquipmentType } from '../types';

interface EquipmentProps {
  equipment: EquipmentType[];
  onToggle: (id: string) => void;
  onUpdateEquipment: (id: string, updates: Partial<EquipmentType>) => void;
  onBack?: () => void;
}

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  weights: { label: 'Weights', icon: 'weight' },
  cardio: { label: 'Cardio', icon: 'monitor_heart' },
  recovery: { label: 'Recovery & Gear', icon: 'self_improvement' },
  other: { label: 'Other', icon: 'category' },
};

const PRESET_BAND_COLORS = [
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Black', color: '#374151' },
  { name: 'Purple', color: '#A855F7' },
  { name: 'Orange', color: '#F97316' },
];

function BandColorConfig({ item, onUpdate }: { item: EquipmentType; onUpdate: (colors: string[]) => void }) {
  const [customInput, setCustomInput] = useState('');
  const colors = item.bandColors || [];

  const toggleColor = (name: string) => {
    if (colors.includes(name)) {
      onUpdate(colors.filter((c) => c !== name));
    } else {
      onUpdate([...colors, name]);
    }
  };

  const addCustom = () => {
    const name = customInput.trim();
    if (name && !colors.includes(name)) {
      onUpdate([...colors, name]);
    }
    setCustomInput('');
  };

  const customColors = colors.filter((c) => !PRESET_BAND_COLORS.some((p) => p.name === c));

  return (
    <div class="px-4 pb-4 pt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
      <p class="text-xs text-slate-400">Select the bands you own:</p>
      <div class="flex flex-wrap gap-2">
        {PRESET_BAND_COLORS.map((preset) => {
          const selected = colors.includes(preset.name);
          return (
            <button
              key={preset.name}
              onClick={() => toggleColor(preset.name)}
              class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selected
                  ? 'bg-white/10 border-2 border-primary'
                  : 'bg-surface-darker border border-white/10 hover:border-white/20'
              }`}
            >
              <div class="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: preset.color }}></div>
              <span class={selected ? 'text-white' : 'text-slate-300'}>{preset.name}</span>
              {selected && <Icon name="check" class="text-primary text-sm" />}
            </button>
          );
        })}
      </div>

      {customColors.length > 0 && (
        <div class="flex flex-wrap gap-2">
          {customColors.map((name) => (
            <div key={name} class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border-2 border-primary text-sm">
              <div class="w-4 h-4 rounded-full bg-slate-400 border border-white/20"></div>
              <span class="text-white font-medium">{name}</span>
              <button onClick={() => toggleColor(name)} class="text-slate-400 hover:text-red-400 ml-1">
                <Icon name="close" class="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div class="flex gap-2">
        <input
          type="text"
          value={customInput}
          onInput={(e) => setCustomInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Add custom band..."
          class="flex-1 bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={addCustom}
          disabled={!customInput.trim()}
          class="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium disabled:opacity-30 transition-opacity"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function EquipmentScreen({ equipment, onToggle, onUpdateEquipment, onBack }: EquipmentProps) {
  const [search, setSearch] = useState('');
  const [expandedBands, setExpandedBands] = useState(false);

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
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="flex items-center justify-between px-4 py-4">
          {onBack ? (
            <button onClick={onBack} class="flex items-center gap-0.5 text-primary text-sm font-medium -ml-1">
              <Icon name="chevron_left" class="text-[20px]" />
              Profile
            </button>
          ) : <div></div>}
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
                {items.map((item) => {
                  const isBands = item.id === 'resistance-bands';
                  const showBandConfig = isBands && item.enabled && expandedBands;

                  return (
                    <div
                      key={item.id}
                      class={`rounded-xl transition-all overflow-hidden ${
                        item.enabled
                          ? 'bg-surface-dark border-2 border-primary shadow-md'
                          : 'bg-surface-dark border border-white/5 hover:border-white/10'
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (isBands && item.enabled) {
                            setExpandedBands(!expandedBands);
                          } else {
                            onToggle(item.id);
                            if (isBands && !item.enabled) setExpandedBands(true);
                          }
                        }}
                        class="w-full flex items-center justify-between p-4"
                      >
                        <div class="flex items-center gap-4">
                          <div class={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.enabled ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-500'
                          }`}>
                            <Icon name={item.icon} />
                          </div>
                          <div class="text-left">
                            <p class={`font-semibold ${item.enabled ? 'text-white' : 'text-slate-300'}`}>{item.name}</p>
                            <p class="text-xs text-slate-500">
                              {isBands && item.enabled && item.bandColors?.length
                                ? `${item.bandColors.join(', ')}`
                                : item.description}
                            </p>
                          </div>
                        </div>
                        <div class="flex items-center gap-3">
                          {isBands && item.enabled && (
                            <Icon name={expandedBands ? 'expand_less' : 'expand_more'} class="text-slate-400" />
                          )}
                          <div
                            onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
                            class={`w-11 h-6 rounded-full relative transition-colors ${
                              item.enabled ? 'bg-primary' : 'bg-slate-700'
                            }`}
                          >
                            <div class={`absolute top-[2px] w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                              item.enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                            }`}></div>
                          </div>
                        </div>
                      </button>

                      {showBandConfig && (
                        <BandColorConfig
                          item={item}
                          onUpdate={(colors) => onUpdateEquipment(item.id, { bandColors: colors })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
