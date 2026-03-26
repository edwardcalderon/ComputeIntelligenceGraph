import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { BootstrapRedirect } from "../BootstrapRedirect";
import { getBootstrapStatus } from "../../lib/api";

const mockReplace = jest.fn();
const mockPathname = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname(),
}));

jest.mock("../../lib/api", () => ({
  getBootstrapStatus: jest.fn(),
}));

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => (key: string) => key,
}));

const mockedGetBootstrapStatus = jest.mocked(getBootstrapStatus);

describe("BootstrapRedirect", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPathname.mockReset();
    mockedGetBootstrapStatus.mockReset();
  });

  it("redirects self-hosted instances to bootstrap when the admin account is missing", async () => {
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
  });
});
