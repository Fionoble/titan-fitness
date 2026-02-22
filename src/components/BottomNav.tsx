import { useLocation } from 'preact-iso';
import { Icon } from './Icon';
import { stripBase, withBase } from '../base';

const tabs = [
  { id: '/', icon: 'home', label: 'Home' },
  { id: '/discover', icon: 'explore', label: 'Discover' },
  { id: '/progress', icon: 'bar_chart', label: 'Progress' },
  { id: '/coach', icon: 'smart_toy', label: 'AI Coach' },
  { id: '/profile', icon: 'person', label: 'Profile' },
];

export function BottomNav() {
  const { path, route } = useLocation();
  const currentPath = stripBase(path);

  return (
    <nav class="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px]">
      <div class="bg-[#0d1b12]/95 backdrop-blur-md border-t border-white/5 pb-safe">
        <div class="flex items-center justify-around px-2 pt-2 pb-3">
          {tabs.map((tab) => {
            const isActive = currentPath === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => route(withBase(tab.id))}
                class={`flex flex-col items-center gap-1 p-1.5 min-w-[48px] transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-500'
                }`}
              >
                <div class={`flex h-8 w-10 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-primary/15' : ''
                }`}>
                  <Icon name={tab.icon} filled={isActive} class="text-[24px]" />
                </div>
                <span class="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
