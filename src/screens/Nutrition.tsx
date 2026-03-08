import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { useNutrition, useRecentFoods } from '../hooks';
import type { RecentFoodItem } from '../hooks';
import { isAIConfigured } from '../ai';
import { estimateNutrition, estimateNutritionWithImage, isJSONResponse, suggestGoals, chatWithNutritionAI } from '../ai-nutrition';
import { getFoodByBarcode, saveFoodCache } from '../db';
import { useStore, runTask, useAITask, clearStore } from '../ai-tasks';
import type { FoodEntry, MealLog, NutritionGoals, UserProfile, StarredFood } from '../types';

interface NutritionProps {
  profile: UserProfile | null;
}

type MealType = MealLog['meal'];

const MEAL_CONFIG: { type: MealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'egg_alt' },
  { type: 'lunch', label: 'Lunch', icon: 'lunch_dining' },
  { type: 'dinner', label: 'Dinner', icon: 'dinner_dining' },
  { type: 'snack', label: 'Snacks', icon: 'cookie' },
];

function getLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Calorie ring SVG component
function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const radius = 80;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(consumed / goal, 1);
  const offset = circumference - (progress * circumference);
  const remaining = Math.max(goal - consumed, 0);
  const overBudget = consumed > goal;

  return (
    <div class="flex flex-col items-center py-4">
      <div class="relative w-[200px] h-[200px]">
        <svg width="200" height="200" viewBox="0 0 200 200" class="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="100" cy="100" r={radius}
            stroke="#1a2e22"
            stroke-width={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="100" cy="100" r={radius}
            stroke={overBudget ? '#ef4444' : '#2bee79'}
            stroke-width={strokeWidth}
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={circumference}
            stroke-dashoffset={offset}
            class="transition-all duration-700 ease-out"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-3xl font-bold text-white">{remaining}</span>
          <span class="text-xs text-slate-400 uppercase tracking-wider">
            {overBudget ? 'over' : 'remaining'}
          </span>
          <div class="flex items-center gap-1 mt-1">
            <Icon name="local_fire_department" class="text-primary text-sm" />
            <span class="text-xs text-slate-300">{consumed} / {goal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Macro progress bar
function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min((current / goal) * 100, 100);
  return (
    <div class="flex-1">
      <div class="flex justify-between items-baseline mb-1">
        <span class="text-xs font-medium text-slate-300">{label}</span>
        <span class="text-xs text-slate-400">{Math.round(current)}g / {goal}g</span>
      </div>
      <div class="h-2 rounded-full bg-surface-darker overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Barcode Scanner component
function BarcodeScanner({ onScan, onClose }: { onScan: (barcode: string) => void; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !scannerRef.current) return;

        const scanner = new Html5Qrcode('barcode-reader');
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {} // ignore scan failures
        );
      } catch (err: any) {
        if (mounted) setError(err.message || 'Camera access denied');
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div class="w-full max-w-[430px] mx-4 bg-bg-dark rounded-2xl overflow-hidden border border-white/10">
        <div class="flex items-center justify-between p-4 border-b border-white/10">
          <h3 class="text-lg font-bold text-white">Scan Barcode</h3>
          <button onClick={onClose} class="w-8 h-8 flex items-center justify-center rounded-full bg-surface-dark text-slate-300">
            <Icon name="close" class="text-lg" />
          </button>
        </div>
        <div class="p-4">
          {error ? (
            <div class="text-center py-8">
              <Icon name="error" class="text-red-400 text-4xl mb-2" />
              <p class="text-slate-300 text-sm">{error}</p>
              <button onClick={onClose} class="mt-4 px-6 py-2 rounded-lg bg-surface-dark text-white text-sm">Close</button>
            </div>
          ) : (
            <div id="barcode-reader" ref={scannerRef} class="rounded-xl overflow-hidden" />
          )}
        </div>
      </div>
    </div>
  );
}

// Recent food row for the Recent tab
function RecentFoodRow({ food, starred, frequency, onToggleStar, onAdd }: {
  food: FoodEntry | StarredFood;
  starred: boolean;
  frequency?: number;
  onToggleStar: () => void;
  onAdd: () => void;
}) {
  return (
    <div class="flex items-center gap-2 bg-surface-darker rounded-lg p-3">
      <button
        onClick={onToggleStar}
        class="w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors hover:bg-white/5"
      >
        <Icon
          name={starred ? 'star' : 'star_border'}
          class={`text-lg ${starred ? 'text-amber-400' : 'text-slate-600'}`}
        />
      </button>
      <div class="flex-1 min-w-0">
        <span class="text-sm text-white truncate block">{food.name}</span>
        <div class="flex gap-2 text-[10px] text-slate-400 mt-0.5">
          <span>{food.calories} cal</span>
          <span>P: {food.protein}g</span>
          <span>C: {food.carbs}g</span>
          <span>F: {food.fats}g</span>
          {frequency && frequency > 1 && (
            <span class="text-primary">{frequency}x</span>
          )}
        </div>
      </div>
      <button
        onClick={onAdd}
        class="w-8 h-8 flex items-center justify-center rounded-full bg-primary/15 text-primary shrink-0 hover:bg-primary/25 transition-colors"
      >
        <Icon name="add" class="text-lg" />
      </button>
    </div>
  );
}

// Add Food Modal
function AddFoodModal({ mealType, onAdd, onAddMultiple, onClose, recentFoods, starredFoods, toggleStar, isStarred, reloadRecent }: {
  mealType: MealType;
  onAdd: (food: FoodEntry) => void;
  onAddMultiple: (foods: FoodEntry[]) => void;
  onClose: () => void;
  recentFoods: RecentFoodItem[];
  starredFoods: StarredFood[];
  toggleStar: (food: FoodEntry) => Promise<void>;
  isStarred: (name: string) => boolean;
  reloadRecent: () => Promise<void>;
}) {
  const hasHistory = recentFoods.length > 0 || starredFoods.length > 0;
  const [tab, setTab] = useState<'recent' | 'manual' | 'scan' | 'ai'>(hasHistory ? 'recent' : (isAIConfigured() ? 'ai' : 'manual'));
  const [recentSearch, setRecentSearch] = useState('');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');

  // AI state — persisted across modal open/close via useStore
  const [aiInput, setAiInput] = useState('');
  const [aiResults, setAiResults] = useStore<FoodEntry[]>('nutrition-ai-results', []);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSelected, setAiSelected] = useState<Set<string>>(new Set());
  const estimateTask = useAITask('nutrition-estimate');
  const aiLoading = estimateTask?.status === 'running';

  // Vision state — persisted across modal open/close
  const [aiImage, setAiImage] = useStore<string | null>('nutrition-ai-image', null);
  const [aiImagePreview, setAiImagePreview] = useStore<string | null>('nutrition-ai-preview', null);
  const [aiMediaType, setAiMediaType] = useStore<string>('nutrition-ai-media-type', 'image/jpeg');
  const [aiConversation, setAiConversation] = useStore<Array<{ role: 'user' | 'assistant'; content: string }>>('nutrition-ai-conversation', []);
  const [aiPhase, setAiPhase] = useStore<'input' | 'clarifying' | 'done'>('nutrition-ai-phase', 'input');
  const [aiClarifyInput, setAiClarifyInput] = useState('');
  const [aiClarifyRounds, setAiClarifyRounds] = useStore<number>('nutrition-ai-clarify-rounds', 0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Restore selection when results are already present on mount
  useEffect(() => {
    if (aiResults.length > 0 && aiSelected.size === 0) {
      setAiSelected(new Set(aiResults.map(r => r.id)));
    }
  }, []);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<FoodEntry | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleManualAdd = () => {
    if (!name.trim()) return;
    const food: FoodEntry = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      calories: Math.round(Number(calories) || 0),
      protein: Math.round(Number(protein) || 0),
      carbs: Math.round(Number(carbs) || 0),
      fats: Math.round(Number(fats) || 0),
      servingSize: Number(servingSize) || 1,
      servingUnit: servingUnit || 'serving',
      source: 'manual',
    };
    onAdd(food);
  };

  const handleImageSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setAiMediaType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAiImagePreview(dataUrl);
      // Extract base64 data (strip data:...;base64, prefix)
      const base64 = dataUrl.split(',')[1];
      setAiImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setAiImage(null);
    setAiImagePreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const parseAIResults = (response: string) => {
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    const items: FoodEntry[] = (Array.isArray(parsed) ? parsed : [parsed]).map((item: any) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: item.name || 'Unknown Food',
      calories: Math.round(item.calories || 0),
      protein: Math.round(item.protein || 0),
      carbs: Math.round(item.carbs || 0),
      fats: Math.round(item.fats || 0),
      servingSize: item.servingSize || 1,
      servingUnit: item.servingUnit || 'serving',
      source: 'ai' as const,
    }));
    return items;
  };

  const handleAIEstimate = async () => {
    if (!aiInput.trim() && !aiImage) return;
    setAiError(null);
    setAiResults([]);
    setAiSelected(new Set());
    setAiConversation([]);
    setAiClarifyRounds(0);

    const inputText = aiInput;
    const image = aiImage;
    const mediaType = aiMediaType;

    runTask('nutrition-estimate', 'nutrition-estimate', async () => {
      if (image) {
        // Vision path
        const response = await estimateNutritionWithImage(image, mediaType, inputText.trim() || undefined);
        if (isJSONResponse(response)) {
          const items = parseAIResults(response);
          setAiResults(items);
          setAiSelected(new Set(items.map(r => r.id)));
          setAiPhase('done');
        } else {
          // AI is asking clarifying questions
          setAiConversation([{ role: 'assistant', content: response }]);
          setAiPhase('clarifying');
          setAiClarifyRounds(1);
        }
      } else {
        // Text-only path (existing)
        const results = await estimateNutrition(inputText);
        setAiResults(results);
        setAiSelected(new Set(results.map(r => r.id)));
        setAiPhase('done');
      }
    }).catch((err: any) => {
      setAiError(err.message || 'Failed to estimate nutrition');
    });
  };

  const handleClarifySend = async () => {
    if (!aiClarifyInput.trim() || !aiImage) return;
    setAiError(null);

    const updatedConversation = [...aiConversation, { role: 'user' as const, content: aiClarifyInput.trim() }];
    setAiConversation(updatedConversation);
    setAiClarifyInput('');

    const image = aiImage;
    const mediaType = aiMediaType;
    const inputText = aiInput;
    const rounds = aiClarifyRounds;

    runTask('nutrition-estimate', 'nutrition-estimate', async () => {
      const forceEstimate = rounds >= 2;
      const response = await estimateNutritionWithImage(
        image, mediaType, inputText.trim() || undefined, updatedConversation, forceEstimate,
      );

      if (isJSONResponse(response)) {
        const items = parseAIResults(response);
        setAiResults(items);
        setAiSelected(new Set(items.map(r => r.id)));
        setAiPhase('done');
      } else {
        setAiConversation([...updatedConversation, { role: 'assistant', content: response }]);
        setAiClarifyRounds((r) => r + 1);
      }
    }).catch((err: any) => {
      setAiError(err.message || 'Failed to estimate nutrition');
    });
  };

  const resetAIVision = () => {
    setAiPhase('input');
    setAiConversation([]);
    setAiClarifyRounds(0);
    setAiResults([]);
    setAiSelected(new Set());
    setAiError(null);
    setAiImage(null);
    setAiImagePreview(null);
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setScanLoading(true);
    setScanError(null);

    try {
      // Check cache first
      const cached = await getFoodByBarcode(barcode);
      if (cached) {
        setScanResult(cached);
        setScanLoading(false);
        return;
      }

      // Look up via Open Food Facts API
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();

      if (data.status !== 1 || !data.product) {
        throw new Error('Product not found in database');
      }

      const product = data.product;
      const nutriments = product.nutriments || {};
      const food: FoodEntry = {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: product.product_name || product.product_name_en || 'Unknown Product',
        calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
        protein: Math.round(nutriments.proteins_100g || nutriments.proteins || 0),
        carbs: Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
        fats: Math.round(nutriments.fat_100g || nutriments.fat || 0),
        servingSize: product.serving_quantity || 100,
        servingUnit: product.serving_quantity ? 'serving' : 'g',
        barcode,
        source: 'scan',
      };

      // Cache the result
      await saveFoodCache(food);
      setScanResult(food);
    } catch (err: any) {
      setScanError(err.message || 'Failed to look up product');
    }
    setScanLoading(false);
  };

  const mealLabel = MEAL_CONFIG.find((m) => m.type === mealType)?.label || mealType;

  return (
    <div class="fixed inset-0 z-[100] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div class="relative w-full max-w-[430px] bg-bg-dark border-t border-white/10 rounded-t-2xl p-5 pb-8 animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
        <div class="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
        <h3 class="text-lg font-bold text-white mb-4">Add to {mealLabel}</h3>

        {/* Tabs */}
        <div class="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar">
          {[
            { id: 'recent' as const, label: 'Recent', icon: 'history' },
            { id: 'manual' as const, label: 'Manual', icon: 'edit' },
            { id: 'scan' as const, label: 'Scan', icon: 'qr_code_scanner' },
            { id: 'ai' as const, label: 'AI', icon: 'auto_awesome' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              class={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
                tab === t.id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-surface-dark text-slate-400 border border-white/5'
              }`}
            >
              <Icon name={t.icon} class="text-base" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Recent tab */}
        {tab === 'recent' && (
          <div class="space-y-3">
            {/* Search */}
            <div class="relative">
              <Icon name="search" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg" />
              <input
                type="text"
                value={recentSearch}
                onInput={(e) => setRecentSearch((e.target as HTMLInputElement).value)}
                placeholder="Search foods..."
                class="w-full bg-surface-dark border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {(() => {
              const query = recentSearch.toLowerCase().trim();
              const filteredStarred = starredFoods
                .filter((s) => !query || s.name.toLowerCase().includes(query))
                .sort((a, b) => b.starredAt - a.starredAt);
              const starredNames = new Set(starredFoods.map((s) => s.name.toLowerCase().trim()));
              const filteredRecent = recentFoods
                .filter((r) => !starredNames.has(r.food.name.toLowerCase().trim()))
                .filter((r) => !query || r.food.name.toLowerCase().includes(query));

              if (filteredStarred.length === 0 && filteredRecent.length === 0) {
                return (
                  <div class="text-center py-8">
                    <Icon name={query ? 'search_off' : 'history'} class="text-4xl text-slate-600 mb-2" />
                    <p class="text-slate-400 text-sm">
                      {query ? 'No foods match your search' : 'No food history yet'}
                    </p>
                    <p class="text-slate-500 text-xs mt-1">
                      {query ? 'Try a different search term' : 'Log some foods and they\'ll appear here for quick reuse'}
                    </p>
                  </div>
                );
              }

              return (
                <>
                  {/* Favorites section */}
                  {filteredStarred.length > 0 && (
                    <div>
                      <div class="flex items-center gap-1.5 mb-2">
                        <Icon name="star" class="text-amber-400 text-sm" />
                        <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Favorites</span>
                      </div>
                      <div class="space-y-1.5">
                        {filteredStarred.map((starred) => (
                          <RecentFoodRow
                            key={starred.id}
                            food={starred}
                            starred={true}
                            onToggleStar={() => toggleStar(starred)}
                            onAdd={() => {
                              const copy: FoodEntry = {
                                ...starred,
                                id: `recent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                              };
                              delete (copy as any).starredAt;
                              onAdd(copy);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent section */}
                  {filteredRecent.length > 0 && (
                    <div>
                      <div class="flex items-center gap-1.5 mb-2">
                        <Icon name="history" class="text-slate-400 text-sm" />
                        <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Recent</span>
                      </div>
                      <div class="space-y-1.5">
                        {filteredRecent.map((item) => (
                          <RecentFoodRow
                            key={item.food.id}
                            food={item.food}
                            starred={false}
                            frequency={item.frequency}
                            onToggleStar={() => toggleStar(item.food)}
                            onAdd={() => {
                              const copy: FoodEntry = {
                                ...item.food,
                                id: `recent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                              };
                              onAdd(copy);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Manual entry */}
        {tab === 'manual' && (
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Food Name</label>
              <input
                type="text"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="e.g. Chicken Breast"
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Calories</label>
              <input
                type="number"
                value={calories}
                onInput={(e) => setCalories((e.target as HTMLInputElement).value)}
                placeholder="kcal"
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Protein</label>
                <input
                  type="number"
                  value={protein}
                  onInput={(e) => setProtein((e.target as HTMLInputElement).value)}
                  placeholder="g"
                  class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Carbs</label>
                <input
                  type="number"
                  value={carbs}
                  onInput={(e) => setCarbs((e.target as HTMLInputElement).value)}
                  placeholder="g"
                  class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Fats</label>
                <input
                  type="number"
                  value={fats}
                  onInput={(e) => setFats((e.target as HTMLInputElement).value)}
                  placeholder="g"
                  class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Serving Size</label>
                <input
                  type="number"
                  value={servingSize}
                  onInput={(e) => setServingSize((e.target as HTMLInputElement).value)}
                  class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Unit</label>
                <input
                  type="text"
                  value={servingUnit}
                  onInput={(e) => setServingUnit((e.target as HTMLInputElement).value)}
                  placeholder="serving, g, oz..."
                  class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
            <button
              onClick={handleManualAdd}
              disabled={!name.trim()}
              class="w-full py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Food
            </button>
          </div>
        )}

        {/* Barcode scanner tab */}
        {tab === 'scan' && (
          <div class="space-y-4">
            {scanLoading ? (
              <div class="flex flex-col items-center py-8 gap-3">
                <div class="w-10 h-10 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
                <span class="text-sm text-slate-300">Looking up product...</span>
              </div>
            ) : scanResult ? (
              <div class="space-y-3">
                <div class="bg-surface-dark rounded-xl p-4 border border-white/5">
                  <h4 class="text-white font-semibold mb-2">{scanResult.name}</h4>
                  <div class="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <span class="text-primary text-lg font-bold block">{scanResult.calories}</span>
                      <span class="text-[10px] text-slate-400 uppercase">cal</span>
                    </div>
                    <div>
                      <span class="text-blue-400 text-lg font-bold block">{scanResult.protein}g</span>
                      <span class="text-[10px] text-slate-400 uppercase">protein</span>
                    </div>
                    <div>
                      <span class="text-amber-400 text-lg font-bold block">{scanResult.carbs}g</span>
                      <span class="text-[10px] text-slate-400 uppercase">carbs</span>
                    </div>
                    <div>
                      <span class="text-rose-400 text-lg font-bold block">{scanResult.fats}g</span>
                      <span class="text-[10px] text-slate-400 uppercase">fats</span>
                    </div>
                  </div>
                  <p class="text-xs text-slate-400 mt-2">Per {scanResult.servingSize} {scanResult.servingUnit}</p>
                </div>
                <div class="flex gap-3">
                  <button
                    onClick={() => { setScanResult(null); setScanError(null); }}
                    class="flex-1 py-3 rounded-xl bg-surface-dark text-slate-300 font-semibold text-sm"
                  >
                    Scan Again
                  </button>
                  <button
                    onClick={() => onAdd(scanResult)}
                    class="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm"
                  >
                    Add Food
                  </button>
                </div>
              </div>
            ) : (
              <div class="text-center py-6">
                {scanError && (
                  <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                    <p class="text-red-400 text-sm">{scanError}</p>
                  </div>
                )}
                <Icon name="qr_code_scanner" class="text-5xl text-slate-500 mb-3" />
                <p class="text-slate-300 text-sm mb-4">Scan a product barcode to auto-fill nutrition info</p>
                <button
                  onClick={() => setShowScanner(true)}
                  class="px-8 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm inline-flex items-center gap-2"
                >
                  <Icon name="photo_camera" class="text-lg" />
                  Open Scanner
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI quick log */}
        {tab === 'ai' && (
          <div class="space-y-4">
            {!isAIConfigured() ? (
              <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
                <Icon name="smart_toy" class="text-3xl text-slate-500 mb-2" />
                <p class="text-slate-300 text-sm mb-1">AI not configured</p>
                <p class="text-slate-500 text-xs">Set up your API key in Profile to use AI Quick Log. You can still use manual entry.</p>
              </div>
            ) : aiPhase === 'input' ? (
              <>
                {/* Photo attachment */}
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Photo (optional)</label>
                  {aiImagePreview ? (
                    <div class="relative inline-block">
                      <img src={aiImagePreview} alt="Food photo" class="w-24 h-24 object-cover rounded-xl border border-white/10" />
                      <button
                        onClick={removeImage}
                        class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                      >
                        <Icon name="close" class="text-sm" />
                      </button>
                    </div>
                  ) : (
                    <div class="flex gap-2">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-dark border border-white/10 text-slate-300 text-sm hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        <Icon name="photo_camera" class="text-lg" />
                        Camera
                      </button>
                      <button
                        onClick={() => galleryInputRef.current?.click()}
                        class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-dark border border-white/10 text-slate-300 text-sm hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        <Icon name="photo_library" class="text-lg" />
                        Gallery
                      </button>
                      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" class="hidden" onChange={handleImageSelect} />
                      <input ref={galleryInputRef} type="file" accept="image/*" class="hidden" onChange={handleImageSelect} />
                    </div>
                  )}
                </div>

                {/* Text description */}
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                    {aiImage ? 'Description (optional)' : 'Describe your food'}
                  </label>
                  <textarea
                    value={aiInput}
                    onInput={(e) => setAiInput((e.target as HTMLTextAreaElement).value)}
                    placeholder={aiImage ? 'e.g. this was a large portion, dressing on the side' : 'e.g. 2 scrambled eggs with toast and a glass of orange juice'}
                    rows={3}
                    class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
                  />
                </div>
                <button
                  onClick={handleAIEstimate}
                  disabled={aiLoading || (!aiInput.trim() && !aiImage)}
                  class="w-full py-3 rounded-xl bg-primary/15 text-primary font-bold text-sm border border-primary/30 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {aiLoading ? (
                    <>
                      <div class="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Icon name="auto_awesome" class="text-lg" />
                      {aiImage ? 'Analyze Photo' : 'Estimate Nutrition'}
                    </>
                  )}
                </button>
                {aiError && (
                  <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p class="text-red-400 text-sm">{aiError}</p>
                  </div>
                )}
              </>
            ) : aiPhase === 'clarifying' ? (
              <>
                {/* Image preview */}
                {aiImagePreview && (
                  <div class="flex justify-center">
                    <img src={aiImagePreview} alt="Food photo" class="w-20 h-20 object-cover rounded-xl border border-white/10 opacity-70" />
                  </div>
                )}

                {/* Conversation bubbles */}
                <div class="space-y-2.5">
                  {aiConversation.map((msg, i) => (
                    <div key={i} class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div class={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-primary text-bg-dark rounded-br-md'
                          : 'bg-surface-dark text-slate-200 rounded-bl-md border border-white/5'
                      }`}>
                        <p class="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div class="flex justify-start">
                      <div class="bg-surface-dark rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                        <div class="flex gap-1.5">
                          <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 0ms" />
                          <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 150ms" />
                          <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 300ms" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clarification input */}
                {!aiLoading && (
                  <div class="flex items-end gap-2">
                    <input
                      type="text"
                      value={aiClarifyInput}
                      onInput={(e) => setAiClarifyInput((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleClarifySend(); }}
                      placeholder="Answer the question..."
                      class="flex-1 bg-surface-dark border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={handleClarifySend}
                      disabled={!aiClarifyInput.trim()}
                      class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-bg-dark shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
                    >
                      <Icon name="send" class="text-lg" />
                    </button>
                  </div>
                )}

                {aiError && (
                  <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p class="text-red-400 text-sm">{aiError}</p>
                  </div>
                )}

                <button
                  onClick={resetAIVision}
                  class="w-full py-2 rounded-lg text-slate-500 text-xs font-medium hover:text-slate-300 transition-colors"
                >
                  Start Over
                </button>
              </>
            ) : (
              /* aiPhase === 'done' — show results */
              <>
                {aiResults.length > 0 && (
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Estimated items</p>
                      <button
                        onClick={() => {
                          if (aiSelected.size === aiResults.length) {
                            setAiSelected(new Set());
                          } else {
                            setAiSelected(new Set(aiResults.map(r => r.id)));
                          }
                        }}
                        class="text-xs text-primary font-medium"
                      >
                        {aiSelected.size === aiResults.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {aiResults.map((food) => {
                      const selected = aiSelected.has(food.id);
                      return (
                        <button
                          key={food.id}
                          onClick={() => {
                            const next = new Set(aiSelected);
                            if (selected) next.delete(food.id);
                            else next.add(food.id);
                            setAiSelected(next);
                          }}
                          class={`w-full text-left bg-surface-dark rounded-xl p-3 border transition-colors ${
                            selected ? 'border-primary/50 bg-primary/5' : 'border-white/5'
                          }`}
                        >
                          <div class="flex items-start gap-3">
                            <div class={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              selected ? 'bg-primary border-primary' : 'border-slate-600'
                            }`}>
                              {selected && <Icon name="check" class="text-bg-dark text-sm" />}
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex justify-between items-start mb-1">
                                <h4 class="text-white font-medium text-sm">{food.name}</h4>
                                <span class="text-primary font-bold text-sm ml-2">{food.calories} cal</span>
                              </div>
                              <div class="flex gap-3 text-xs text-slate-400">
                                <span>P: {food.protein}g</span>
                                <span>C: {food.carbs}g</span>
                                <span>F: {food.fats}g</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {aiSelected.size > 0 && (
                      <button
                        onClick={() => {
                          const selected = aiResults.filter(f => aiSelected.has(f.id));
                          onAddMultiple(selected);
                        }}
                        class="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
                      >
                        Add {aiSelected.size === aiResults.length ? 'All' : aiSelected.size} {aiSelected.size === 1 ? 'Item' : 'Items'} to {mealLabel}
                      </button>
                    )}
                    <button
                      onClick={resetAIVision}
                      class="w-full py-2 rounded-lg text-slate-500 text-xs font-medium hover:text-slate-300 transition-colors"
                    >
                      Estimate Another
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Cancel button */}
        <button
          onClick={onClose}
          class="w-full py-3 rounded-xl bg-surface-dark text-slate-300 font-semibold text-sm mt-4"
        >
          Cancel
        </button>
      </div>

      {/* Barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}

// Goals editor modal
function GoalsModal({ goals, onSave, onClose, profile }: {
  goals: NutritionGoals;
  onSave: (goals: NutritionGoals) => void;
  onClose: () => void;
  profile: UserProfile | null;
}) {
  const [cal, setCal] = useState(goals.calories.toString());
  const [pro, setPro] = useState(goals.protein.toString());
  const [carb, setCarb] = useState(goals.carbs.toString());
  const [fat, setFat] = useState(goals.fats.toString());
  const [aiLoading, setAiLoading] = useState(false);

  const handleSave = () => {
    onSave({
      calories: Math.round(Number(cal) || 2000),
      protein: Math.round(Number(pro) || 150),
      carbs: Math.round(Number(carb) || 200),
      fats: Math.round(Number(fat) || 65),
      source: 'manual',
    });
  };

  const handleAISuggest = async () => {
    if (!profile) return;
    setAiLoading(true);
    try {
      const suggested = await suggestGoals(profile);
      setCal(suggested.calories.toString());
      setPro(suggested.protein.toString());
      setCarb(suggested.carbs.toString());
      setFat(suggested.fats.toString());
    } catch {
      // Silent fail, user can still set manually
    }
    setAiLoading(false);
  };

  return (
    <div class="fixed inset-0 z-[100] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div class="relative w-full max-w-[430px] bg-bg-dark border-t border-white/10 rounded-t-2xl p-5 pb-8 animate-slide-up">
        <div class="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
        <h3 class="text-lg font-bold text-white mb-4">Daily Goals</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Calories (kcal)</label>
            <input
              type="number"
              value={cal}
              onInput={(e) => setCal((e.target as HTMLInputElement).value)}
              class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Protein (g)</label>
              <input
                type="number"
                value={pro}
                onInput={(e) => setPro((e.target as HTMLInputElement).value)}
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Carbs (g)</label>
              <input
                type="number"
                value={carb}
                onInput={(e) => setCarb((e.target as HTMLInputElement).value)}
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Fats (g)</label>
              <input
                type="number"
                value={fat}
                onInput={(e) => setFat((e.target as HTMLInputElement).value)}
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {isAIConfigured() && profile && (
          <button
            onClick={handleAISuggest}
            disabled={aiLoading}
            class="w-full py-2.5 rounded-xl bg-primary/10 text-primary font-semibold text-sm mt-4 border border-primary/20 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {aiLoading ? (
              <>
                <div class="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Suggesting...
              </>
            ) : (
              <>
                <Icon name="auto_awesome" class="text-base" />
                AI Suggest Goals
              </>
            )}
          </button>
        )}

        <div class="flex gap-3 mt-5">
          <button onClick={onClose} class="flex-1 py-3 rounded-xl bg-surface-dark text-slate-300 font-semibold text-sm">
            Cancel
          </button>
          <button onClick={handleSave} class="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm">
            Save Goals
          </button>
        </div>
      </div>
    </div>
  );
}

// Meal Section Component
function MealSection({ config, entries, onAddFood, onRemoveFood, onToggleStar, isStarred }: {
  config: { type: MealType; label: string; icon: string };
  entries: FoodEntry[];
  onAddFood: () => void;
  onRemoveFood: (foodId: string) => void;
  onToggleStar: (food: FoodEntry) => void;
  isStarred: (name: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(entries.length > 0);
  const totalCals = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <div class="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center justify-between p-4 text-left"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-surface-darker flex items-center justify-center">
            <Icon name={config.icon} class="text-primary text-xl" />
          </div>
          <div>
            <h4 class="text-white font-semibold text-sm">{config.label}</h4>
            <span class="text-xs text-slate-400">
              {entries.length === 0 ? 'No items logged' : `${entries.length} item${entries.length > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-slate-300">{totalCals} cal</span>
          <Icon name={expanded ? 'expand_less' : 'expand_more'} class="text-slate-500" />
        </div>
      </button>

      {expanded && (
        <div class="px-4 pb-4 space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} class="flex items-center justify-between bg-surface-darker rounded-lg p-3">
              <button
                onClick={() => onToggleStar(entry)}
                class="w-7 h-7 flex items-center justify-center rounded-full shrink-0 mr-2 hover:bg-white/5 transition-colors"
              >
                <Icon
                  name={isStarred(entry.name) ? 'star' : 'star_border'}
                  class={`text-base ${isStarred(entry.name) ? 'text-amber-400' : 'text-slate-600'}`}
                />
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-white truncate">{entry.name}</span>
                  {entry.source === 'ai' && <Icon name="auto_awesome" class="text-primary text-xs" />}
                  {entry.source === 'scan' && <Icon name="qr_code" class="text-blue-400 text-xs" />}
                </div>
                <div class="flex gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span>P: {entry.protein}g</span>
                  <span>C: {entry.carbs}g</span>
                  <span>F: {entry.fats}g</span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm font-medium text-slate-300">{entry.calories} cal</span>
                <button
                  onClick={() => onRemoveFood(entry.id)}
                  class="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Icon name="close" class="text-sm" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={onAddFood}
            class="w-full py-2.5 rounded-lg border border-dashed border-white/10 text-slate-400 text-sm font-medium flex items-center justify-center gap-2 hover:border-primary/30 hover:text-primary transition-colors"
          >
            <Icon name="add" class="text-lg" />
            Add Food
          </button>
        </div>
      )}
    </div>
  );
}

// Nutrition Chat
interface NutritionChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const NUTRITION_QUICK_ACTIONS = [
  { label: 'What should I eat next?', icon: 'restaurant' },
  { label: 'Am I hitting my macros?', icon: 'analytics' },
  { label: 'Suggest a high-protein snack', icon: 'egg_alt' },
  { label: 'How can I improve my diet?', icon: 'lightbulb' },
];

function NutritionChat({ totals, goals }: {
  totals: { calories: number; protein: number; carbs: number; fats: number };
  goals: NutritionGoals;
}) {
  const [messages, setMessages] = useStore<NutritionChatMessage[]>('nutrition-chat', []);
  const [input, setInput] = useState('');
  const chatTask = useAITask('nutrition-chat');
  const loading = chatTask?.status === 'running';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: NutritionChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const currentMessages = messages;
    runTask('nutrition-chat', 'nutrition-chat', async () => {
      const chatHistory = currentMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));
      const response = await chatWithNutritionAI(text.trim(), chatHistory, { totals, goals });
      const aiMsg: NutritionChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      return response;
    }).catch((err: any) => {
      const errMsg: NutritionChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err.message || 'Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isAIConfigured()) {
    return (
      <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
        <Icon name="smart_toy" class="text-3xl text-slate-500 mb-2" />
        <p class="text-slate-300 text-sm mb-1">AI Nutrition Coach</p>
        <p class="text-slate-500 text-xs">Set up your API key in Profile to chat about nutrition.</p>
      </div>
    );
  }

  return (
    <div class="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div class="flex items-center gap-3 p-4 border-b border-white/5">
        <div class="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon name="nutrition" class="text-primary text-xl" />
        </div>
        <div class="flex-1">
          <h4 class="text-white font-semibold text-sm">Nutrition Coach</h4>
          <span class="text-xs text-slate-400">Ask about food, macros, meal ideas</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => clearStore('nutrition-chat')}
            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface-darker text-slate-400 hover:text-red-400 transition-colors"
            title="Clear chat"
          >
            <Icon name="delete_sweep" class="text-lg" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div class="max-h-[400px] overflow-y-auto no-scrollbar">
        {messages.length === 0 ? (
          <div class="p-4 space-y-2">
            <p class="text-xs text-slate-500 mb-3">Quick questions:</p>
            {NUTRITION_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.label)}
                class="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-darker text-left hover:bg-white/5 transition-colors"
              >
                <Icon name={action.icon} class="text-primary text-lg" />
                <span class="text-sm text-slate-300">{action.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div class="p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div class={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-bg-dark rounded-br-md'
                    : 'bg-surface-darker text-slate-200 rounded-bl-md'
                }`}>
                  <p class="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div class="flex justify-start">
                <div class="bg-surface-darker rounded-2xl rounded-bl-md px-4 py-3">
                  <div class="flex gap-1.5">
                    <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 0ms" />
                    <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 150ms" />
                    <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 300ms" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div class="p-3 border-t border-white/5">
        <div class="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about nutrition..."
            rows={1}
            class="flex-1 bg-surface-darker border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-bg-dark shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            <Icon name="send" class="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid DST issues
  d.setDate(d.getDate() + days);
  return getLocalDate(d);
}

function formatDisplayDate(dateStr: string): string {
  const today = getLocalDate();
  const yesterday = shiftDate(today, -1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Nutrition({ profile }: NutritionProps) {
  const [date, setDate] = useState(getLocalDate());
  const { meals, goals, totals, loading, addFoodToMeal, removeFoodFromMeal, updateGoals } = useNutrition(date);
  const { recentFoods, starredFoods, toggleStar, isStarred, reload: reloadRecent } = useRecentFoods();
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const isToday = date === getLocalDate();

  const handleAddFood = useCallback((food: FoodEntry) => {
    if (!addingMeal) return;
    addFoodToMeal(addingMeal, food);
  }, [addingMeal, addFoodToMeal]);

  const handleAddFoodAndClose = useCallback((food: FoodEntry) => {
    handleAddFood(food);
    setAddingMeal(null);
    reloadRecent();
  }, [handleAddFood, reloadRecent]);

  const handleAddMultipleFoods = useCallback((foods: FoodEntry[]) => {
    if (!addingMeal) return;
    foods.forEach((f) => addFoodToMeal(addingMeal, f));
    setAddingMeal(null);
    reloadRecent();
  }, [addingMeal, addFoodToMeal, reloadRecent]);

  const getMealEntries = useCallback((mealType: MealType): FoodEntry[] => {
    const meal = meals.find((m) => m.meal === mealType);
    return meal?.entries || [];
  }, [meals]);

  if (loading) {
    return (
      <div class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <div class="w-10 h-10 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
          <span class="text-sm text-slate-400">Loading nutrition data...</span>
        </div>
      </div>
    );
  }

  return (
    <main class="flex-1 overflow-y-auto no-scrollbar pb-40">
      {/* Header */}
      <div class="px-5 pt-6 pt-safe pb-2">
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-sm font-medium text-slate-400">Track your meals</p>
            <h1 class="text-2xl font-bold tracking-tight text-white">Nutrition</h1>
          </div>
          <button
            onClick={() => setShowGoals(true)}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
            title="Edit goals"
          >
            <Icon name="tune" />
          </button>
        </div>
        {/* Date navigation */}
        <div class="flex items-center justify-between bg-surface-dark rounded-xl px-3 py-2 border border-white/5">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-primary hover:bg-white/5 transition-colors"
          >
            <Icon name="chevron_left" class="text-xl" />
          </button>
          <button
            onClick={() => setDate(getLocalDate())}
            class="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Icon name="calendar_today" class="text-primary text-sm" />
            <span class="text-sm font-semibold text-white">{formatDisplayDate(date)}</span>
          </button>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={isToday}
            class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Icon name="chevron_right" class="text-xl" />
          </button>
        </div>
      </div>

      {/* Calorie Ring */}
      <div class="px-5 relative flex justify-center" style={{ height: '220px' }}>
        <CalorieRing consumed={totals.calories} goal={goals.calories} />
      </div>

      {/* Macro Bars */}
      <div class="px-5 mb-6">
        <div class="bg-surface-dark rounded-xl p-4 border border-white/5 space-y-3">
          <MacroBar label="Protein" current={totals.protein} goal={goals.protein} color="#60a5fa" />
          <MacroBar label="Carbs" current={totals.carbs} goal={goals.carbs} color="#fbbf24" />
          <MacroBar label="Fats" current={totals.fats} goal={goals.fats} color="#f87171" />
        </div>
      </div>

      {/* Meal Sections */}
      <div class="px-5 space-y-3">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-lg font-bold text-white">Meals</h3>
          <span class="text-xs text-primary font-medium">{totals.calories} cal total</span>
        </div>
        {MEAL_CONFIG.map((config) => (
          <MealSection
            key={config.type}
            config={config}
            entries={getMealEntries(config.type)}
            onAddFood={() => setAddingMeal(config.type)}
            onRemoveFood={(foodId) => removeFoodFromMeal(config.type, foodId)}
            onToggleStar={toggleStar}
            isStarred={isStarred}
          />
        ))}
      </div>

      {/* Nutrition Chat */}
      <div class="px-5 pt-6 pb-10">
        <h3 class="text-lg font-bold text-white mb-3">Nutrition Coach</h3>
        <NutritionChat totals={totals} goals={goals} />
      </div>

      {/* Add food modal */}
      {addingMeal && (
        <AddFoodModal
          mealType={addingMeal}
          onAdd={handleAddFoodAndClose}
          onAddMultiple={handleAddMultipleFoods}
          onClose={() => setAddingMeal(null)}
          recentFoods={recentFoods}
          starredFoods={starredFoods}
          toggleStar={toggleStar}
          isStarred={isStarred}
          reloadRecent={reloadRecent}
        />
      )}

      {/* Goals modal */}
      {showGoals && (
        <GoalsModal
          goals={goals}
          onSave={(g) => { updateGoals(g); setShowGoals(false); }}
          onClose={() => setShowGoals(false)}
          profile={profile}
        />
      )}
    </main>
  );
}
