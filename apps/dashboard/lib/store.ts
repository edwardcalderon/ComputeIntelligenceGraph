import { create } from "zustand";

type Theme = "light" | "dark";

interface AppState {
  selectedResource: string | null;
  sidebarOpen: boolean;
  theme: Theme;
  setSelectedResource: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedResource: null,
  sidebarOpen: true,
  theme: "light",
  setSelectedResource: (id) => set({ selectedResource: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
