import { createContext } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useRef, useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

// Context holds a ref to the DOM node inside BottomNav where content is portaled into
const NavSlotContext = createContext<HTMLDivElement | null>(null);

/** Wrap around BottomNav's slot container to provide the portal target */
export function NavSlotTarget({ children }: { children?: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setNode(ref.current);
  }, []);

  return (
    <NavSlotContext.Provider value={node}>
      <div ref={ref} class="contents" />
      {children}
    </NavSlotContext.Provider>
  );
}

/** Portal children into the nav slot above the island. Content clears on unmount. */
export function NavSlot({ children }: { children: ComponentChildren }) {
  const target = useContext(NavSlotContext);
  if (!target) return null;
  return createPortal(
    <div class="w-full max-w-[430px] mx-auto px-4 mb-2 pointer-events-auto">
      {children}
    </div>,
    target
  );
}
