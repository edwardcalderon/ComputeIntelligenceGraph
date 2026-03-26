import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { BootstrapRedirect } from "../BootstrapRedirect";
import { getBootstrapStatus } from "../../lib/api";
import { getBootstrapPromptKey } from "../../lib/bootstrapPreferences";

const mockReplace = jest.fn();
const mockPathname = jest.fn();
const mockNotifyUser = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname(),
}));

jest.mock("../../lib/api", () => ({
  getBootstrapStatus: jest.fn(),
}));

jest.mock("../NotificationBell", () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
}));

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => (key: string) => key,
}));

const mockedGetBootstrapStatus = jest.mocked(getBootstrapStatus);

describe("BootstrapRedirect", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPathname.mockReset();
    mockNotifyUser.mockReset();
    mockedGetBootstrapStatus.mockReset();
    localStorage.clear();
  });

  it("redirects self-hosted instances to bootstrap once and stores the preference", async () => {
    mockPathname.mockReturnValue("/overview");
    mockedGetBootstrapStatus.mockResolvedValue({
      mode: "self-hosted",
      requires_bootstrap: true,
    });

    render(
      <BootstrapRedirect>
        <div>dashboard content</div>
      </BootstrapRedirect>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/bootstrap");
    });

    expect(mockNotifyUser).toHaveBeenCalledWith(
      expect.stringContaining("Self-hosted setup is required"),
      "progress"
    );
    expect(localStorage.getItem(getBootstrapPromptKey())).toBe("1");
  });

  it("does not redirect again after the bootstrap preference was already set", async () => {
    localStorage.setItem(getBootstrapPromptKey(), "1");
    mockPathname.mockReturnValue("/overview");
    mockedGetBootstrapStatus.mockResolvedValue({
      mode: "self-hosted",
      requires_bootstrap: true,
    });

    const { rerender } = render(
      <BootstrapRedirect>
        <div>dashboard content</div>
      </BootstrapRedirect>
    );

    expect(await screen.findByText("dashboard content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockNotifyUser).not.toHaveBeenCalled();

    rerender(
      <BootstrapRedirect>
        <div>dashboard content</div>
      </BootstrapRedirect>
    );

    expect(mockedGetBootstrapStatus).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children without redirecting on managed instances", async () => {
    mockPathname.mockReturnValue("/overview");
    mockedGetBootstrapStatus.mockResolvedValue({
      mode: "managed",
      requires_bootstrap: false,
    });

    render(
      <BootstrapRedirect>
        <div>dashboard content</div>
      </BootstrapRedirect>
    );

    expect(await screen.findByText("dashboard content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(localStorage.getItem(getBootstrapPromptKey())).toBeNull();
  });
});
