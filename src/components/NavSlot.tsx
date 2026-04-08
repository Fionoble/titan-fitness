import { createContext } from 'preact';
import { useContext, useState, useCallback, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

type NavSlotContextType = {
  content: ComponentChildren;
  setContent: (content: ComponentChildren) => void;
};

const NavSlotContext = createContext<NavSlotContextType>({
  content: null,
  setContent: () => {},
});

export function NavSlotProvider({ children }: { children: ComponentChildren }) {
  const [content, setContent] = useState<ComponentChildren>(null);
  return (
    <NavSlotContext.Provider value={{ content, setContent }}>
      {children}
    </NavSlotContext.Provider>
  );
}

/** Returns the current nav slot content (used by BottomNav) */
export function useNavSlotContent(): ComponentChildren {
  return useContext(NavSlotContext).content;
}

/** Sets content to render above the nav island. Clears on unmount. */
export function useNavSlot(content: ComponentChildren) {
  const { setContent } = useContext(NavSlotContext);
  useEffect(() => {
    setContent(content);
    return () => setContent(null);
  }, [content]);
}
