import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getTheme, applyTheme, defaultTheme, type Theme } from "@/lib/themes";

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeId: string) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem("luma-theme");
    return saved || defaultTheme;
  });

  const theme = getTheme(currentTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("luma-theme", currentTheme);
  }, [currentTheme, theme]);

  const setTheme = (themeId: string) => {
    setCurrentTheme(themeId);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
