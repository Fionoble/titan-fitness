import { useLocation } from 'preact-iso';
import { Icon } from './Icon';
import { stripBase, withBase } from '../base';
import { useNavSlotContent } from './NavSlot';

const tabs = [
  { id: '/', icon: 'home', label: 'Home' },
  { id: '/nutrition', icon: 'restaurant', label: 'Nutrition' },
  { id: '/progress', icon: 'bar_chart', label: 'Progress' },
  { id: '/coach', icon: 'smart_toy', label: 'AI Coach' },
  { id: '/profile', icon: 'person', label: 'Profile' },
];

export function BottomNav() {
  const { path, route } = useLocation();
  const currentPath = stripBase(path);
  const above = useNavSlotContent();

  return (
    <div class="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none pb-safe">
      {/* Slot for content above the nav (input fields, buttons, etc.) */}
      {above && (
        <div class="w-full max-w-[430px] px-4 mb-2 pointer-events-auto">
          {above}
        </div>
      )}

      <nav class="nav-island pointer-events-auto mx-4 mb-2 px-2 py-1.5 flex items-center justify-around gap-1 max-w-[400px] w-full">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => route(withBase(tab.id))}
              class={`nav-tab flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-0 flex-1 rounded-2xl transition-all duration-300 ${
                isActive ? 'nav-tab-active' : ''
              }`}
            >
              <Icon
                name={tab.icon}
                filled={isActive}
                class={`transition-all duration-300 ${
                  isActive ? 'text-primary text-[22px] drop-shadow-[0_0_8px_rgba(43,238,121,0.4)]' : 'text-white/50 text-[20px]'
                }`}
              />
              <span class={`text-[9px] font-semibold tracking-wide transition-all duration-300 ${
                isActive ? 'text-primary' : 'text-white/40'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
