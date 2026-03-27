import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProductionAuthGuard } from "../ProductionAuthGuard";
import { clearBrowserSession, getBrowserAccessToken } from "../../lib/cigClient";

const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("../../lib/cigClient", () => ({
  clearBrowserSession: jest.fn(),
  getBrowserAccessToken: jest.fn(),
}));

const mockGetBrowserAccessToken = jest.mocked(getBrowserAccessToken);
const mockClearBrowserSession = jest.mocked(clearBrowserSession);

describe("ProductionAuthGuard", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/graph");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("x=1"));
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        hostname: "app.cig.lat",
        protocol: "https:",
        replace: jest.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("redirects protected-host visits when no browser session exists", async () => {
    mockGetBrowserAccessToken.mockReturnValue(null);

    render(
      <ProductionAuthGuard>
        <div>Protected content</div>
      </ProductionAuthGuard>,
    );

    expect(screen.getByText("Redirecting to sign in…")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockClearBrowserSession).toHaveBeenCalledTimes(1);
      expect(window.location.replace).toHaveBeenCalledWith(
        "https://cig.lat/?auth=signin&dashboard_redirect=%2Fgraph%3Fx%3D1",
      );
    });
  });

  it("renders children when a valid browser session exists", () => {
    mockGetBrowserAccessToken.mockReturnValue("token");

    render(
      <ProductionAuthGuard>
        <div>Protected content</div>
      </ProductionAuthGuard>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(mockClearBrowserSession).not.toHaveBeenCalled();
  });
});
