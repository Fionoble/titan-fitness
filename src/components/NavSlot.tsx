import { createContext } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useRef, useEffect, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

type NavSlotContextType = {
  target: HTMLDivElement | null;
  setTarget: (el: HTMLDivElement | null) => void;
};

const NavSlotContext = createContext<NavSlotContextType>({
  target: null,
  setTarget: () => {},
});

/** Wrap around the app to provide the portal target registry */
export function NavSlotProvider({ children }: { children: ComponentChildren }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <NavSlotContext.Provider value={{ target, setTarget }}>
      {children}
    </NavSlotContext.Provider>
  );
}

/** Place inside BottomNav to register the portal target DOM node */
export function NavSlotTarget() {
  const ref = useRef<HTMLDivElement>(null);
  const { setTarget } = useContext(NavSlotContext);

  useEffect(() => {
    setTarget(ref.current);
    return () => setTarget(null);
  }, []);

  return <div ref={ref} class="contents" />;
}

/** Portal children into the nav slot above the island. */
export function NavSlot({ children }: { children: ComponentChildren }) {
  const { target } = useContext(NavSlotContext);
  if (!target) return null;
  return createPortal(
    <div class="w-full max-w-[430px] mx-auto px-4 mb-2 pointer-events-auto">
      {children}
    </div>,
    target
  );
}
