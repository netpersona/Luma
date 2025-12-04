import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type UIScale = "75" | "100" | "125" | "150";

interface UIScaleContextType {
  scale: UIScale;
  setScale: (scale: UIScale) => void;
  scaleValue: number;
}

const UIScaleContext = createContext<UIScaleContextType | undefined>(undefined);

const STORAGE_KEY = "luma-ui-scale";

function getStoredScale(): UIScale {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "100";
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["75", "100", "125", "150"].includes(saved)) {
      return saved as UIScale;
    }
  } catch {
  }
  return "100";
}

export function UIScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<UIScale>(getStoredScale);

  const scaleValue = parseInt(scale) / 100;

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(STORAGE_KEY, scale);
    } catch {
    }
    
    const root = document.documentElement;
    root.style.fontSize = `${scaleValue * 16}px`;
    root.setAttribute("data-ui-scale", scale);
  }, [scale, scaleValue]);

  const setScale = (newScale: UIScale) => {
    setScaleState(newScale);
  };

  return (
    <UIScaleContext.Provider value={{ scale, setScale, scaleValue }}>
      {children}
    </UIScaleContext.Provider>
  );
}

export function useUIScale() {
  const context = useContext(UIScaleContext);
  if (!context) {
    throw new Error("useUIScale must be used within UIScaleProvider");
  }
  return context;
}

export const scaleOptions: { value: UIScale; label: string }[] = [
  { value: "75", label: "75% (Compact)" },
  { value: "100", label: "100% (Default)" },
  { value: "125", label: "125% (Large)" },
  { value: "150", label: "150% (Extra Large)" },
];
