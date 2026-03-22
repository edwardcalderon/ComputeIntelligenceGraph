"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthProvider } from "../components/AuthProvider";
import { I18nProvider } from "@cig-technology/i18n/react";
import { initI18n } from "./i18n";

type Theme = "light" | "dark";

const ThemeCtx = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}>({ theme: "dark", setTheme: () => {}, toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("cig-theme") as Theme | null;
    const initial = stored === "light" ? "light" : "dark";
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("cig-theme", t);
    document.documentElement.classList.add("transitioning");
    document.documentElement.classList.toggle("dark", t === "dark");
    setTimeout(() => document.documentElement.classList.remove("transitioning"), 300);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

// Initialize i18n catalogs once at module level
initI18n();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
