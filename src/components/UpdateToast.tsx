/// <reference types="vite-plugin-pwa/preact" />
import { useRegisterSW } from 'virtual:pwa-register/preact';

export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div class="fixed top-4 left-4 right-4 z-[9999] flex items-center justify-between gap-3 rounded-xl bg-[#1a2e22] border border-[#2bee79]/30 px-4 py-3 shadow-lg">
      <span class="text-sm text-white/90">Update available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        class="shrink-0 rounded-lg bg-[#2bee79] px-3 py-1.5 text-sm font-semibold text-[#102217]"
      >
        Refresh
      </button>
    </div>
  );
}
