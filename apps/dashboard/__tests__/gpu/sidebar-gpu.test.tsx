/**
 * Unit tests for the GPU Compute navigation section in the Sidebar.
 *
 * Validates: Requirements 1.1, 1.4
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockPathname = "/gpu";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children, className, onClick }: {
      href: string;
      children: React.ReactNode;
      className?: string;
      onClick?: () => void;
    }) => (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      "sidebar.platform": "Platform",
      "sidebar.gpuCompute": "GPU Compute",
      "sidebar.operations": "Operations",
      "sidebar.account": "Account",
      "nav.overview": "Overview",
      "nav.resources": "Resources",
      "nav.graph": "Graph",
      "nav.costs": "Costs",
      "nav.security": "Security",
      "nav.gpu.sessions": "Sessions",
      "nav.gpu.health": "Health",
      "nav.gpu.logs": "Logs",
      "nav.gpu.config": "Config",
      "nav.gpu.activity": "Activity",
      "nav.devices": "Devices",
      "nav.targets": "Targets",
      "nav.bootstrap": "Bootstrap",
      "nav.notifications": "Notifications",
      "nav.profile": "Profile",
      "nav.settings": "Settings",
      "nav.docs": "Documentation",
    };
    return translations[key] ?? key;
  },
}));

jest.mock("../../lib/store", () => ({
  useAppStore: () => ({
    sidebarOpen: true,
    setSidebarOpen: jest.fn(),
  }),
}));

jest.mock("@cig/ui/siteUrl.client", () => ({
  useResolvedLandingUrl: () => "https://cig.example.com",
  useResolvedDocsUrl: () => "https://docs.cig.example.com",
}));

jest.mock("../../components/UserMenu", () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { Sidebar } from "../../components/Sidebar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/gpu";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar GPU Navigation", () => {
  // -----------------------------------------------------------------------
  // Requirement 1.1: GPU Compute section renders with correct items
  // -----------------------------------------------------------------------
  describe("GPU Compute section", () => {
    it("renders the GPU Compute section title", () => {
      render(<Sidebar />);

      expect(screen.getByText("GPU Compute")).toBeInTheDocument();
    });

    it("renders all five GPU navigation items", () => {
      render(<Sidebar />);

      expect(screen.getByText("Sessions")).toBeInTheDocument();
      expect(screen.getByText("Health")).toBeInTheDocument();
      expect(screen.getByText("Logs")).toBeInTheDocument();
      expect(screen.getByText("Config")).toBeInTheDocument();
      expect(screen.getByText("Activity")).toBeInTheDocument();
    });

    it("renders GPU nav items with correct href links", () => {
      render(<Sidebar />);

      const sessionsLink = screen.getByText("Sessions").closest("a");
      const healthLink = screen.getByText("Health").closest("a");
      const logsLink = screen.getByText("Logs").closest("a");
      const configLink = screen.getByText("Config").closest("a");
      const activityLink = screen.getByText("Activity").closest("a");

      expect(sessionsLink).toHaveAttribute("href", "/gpu");
      expect(healthLink).toHaveAttribute("href", "/gpu/health");
      expect(logsLink).toHaveAttribute("href", "/gpu/logs");
      expect(configLink).toHaveAttribute("href", "/gpu/config");
      expect(activityLink).toHaveAttribute("href", "/gpu/activity");
    });

    it("renders GPU Compute section between Platform and Operations", () => {
      render(<Sidebar />);

      const sectionTitles = screen.getAllByText(/^(Platform|GPU Compute|Operations|Account)$/);
      const titleTexts = sectionTitles.map((el) => el.textContent);

      const platformIdx = titleTexts.indexOf("Platform");
      const gpuIdx = titleTexts.indexOf("GPU Compute");
      const opsIdx = titleTexts.indexOf("Operations");

      expect(platformIdx).toBeLessThan(gpuIdx);
      expect(gpuIdx).toBeLessThan(opsIdx);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 1.4: Active state highlighting
  // -----------------------------------------------------------------------
  describe("active state highlighting", () => {
    it("highlights Sessions item when on /gpu", () => {
      mockPathname = "/gpu";
      render(<Sidebar />);

      const sessionsLink = screen.getByText("Sessions").closest("a");
      // Active items get the "text-cig-primary" class
      expect(sessionsLink?.className).toContain("text-cig-primary");
    });

    it("highlights Sessions item when on /gpu/sessions/[id]", () => {
      mockPathname = "/gpu/sessions/sess-001";
      render(<Sidebar />);

      const sessionsLink = screen.getByText("Sessions").closest("a");
      expect(sessionsLink?.className).toContain("text-cig-primary");
    });

    it("highlights Health item when on /gpu/health", () => {
      mockPathname = "/gpu/health";
      render(<Sidebar />);

      const healthLink = screen.getByText("Health").closest("a");
      expect(healthLink?.className).toContain("text-cig-primary");
    });

    it("highlights Logs item when on /gpu/logs", () => {
      mockPathname = "/gpu/logs";
      render(<Sidebar />);

      const logsLink = screen.getByText("Logs").closest("a");
      expect(logsLink?.className).toContain("text-cig-primary");
    });

    it("does not highlight Sessions when on /gpu/health", () => {
      mockPathname = "/gpu/health";
      render(<Sidebar />);

      const sessionsLink = screen.getByText("Sessions").closest("a");
      // Non-active items get "text-cig-secondary" class
      expect(sessionsLink?.className).toContain("text-cig-secondary");
    });
  });
});
