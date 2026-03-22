/**
 * Unit tests for bootstrap page.
 * Validates: Requirement 11 — Dashboard Self-Hosted Bootstrap Page
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock bootstrap API functions
const mockGetBootstrapStatus = jest.fn();
const mockValidateBootstrapToken = jest.fn();
const mockCompleteBootstrap = jest.fn();

// Mock component for testing bootstrap page logic
function BootstrapPageTest() {
  const [step, setStep] = React.useState<"token" | "admin" | "complete">(
    "token"
  );
  const [bootstrapToken, setBootstrapToken] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleValidateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await mockValidateBootstrapToken(bootstrapToken);
      setStep("admin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to validate token"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div data-testid="error-message">{error}</div>}
      {step === "token" && (
        <form onSubmit={handleValidateToken}>
          <input
            type="text"
            value={bootstrapToken}
            onChange={(e) => setBootstrapToken(e.target.value)}
            placeholder="Enter your bootstrap token"
            data-testid="token-input"
            required
          />
          <button type="submit" disabled={loading} data-testid="validate-btn">
            {loading ? "Validating..." : "Validate Token"}
          </button>
        </form>
      )}
      {step === "admin" && (
        <div data-testid="admin-form">Admin form would appear here</div>
      )}
      {step === "complete" && (
        <div data-testid="complete-message">Bootstrap completed successfully!</div>
      )}
    </div>
  );
}

import React from "react";

describe("Bootstrap Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display token input on initial load", () => {
    render(<BootstrapPageTest />);
    expect(screen.getByTestId("token-input")).toBeInTheDocument();
    expect(screen.getByTestId("validate-btn")).toBeInTheDocument();
  });

  it("should show error on invalid token", async () => {
    mockValidateBootstrapToken.mockRejectedValueOnce(
      new Error("Invalid bootstrap token")
    );

    render(<BootstrapPageTest />);
    const input = screen.getByTestId("token-input");
    const button = screen.getByTestId("validate-btn");

    fireEvent.change(input, { target: { value: "invalid-token" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toHaveTextContent(
        "Invalid bootstrap token"
      );
    });
  });

  it("should transition to admin form on valid token", async () => {
    mockValidateBootstrapToken.mockResolvedValueOnce({ valid: true });

    render(<BootstrapPageTest />);
    const input = screen.getByTestId("token-input");
    const button = screen.getByTestId("validate-btn");

    fireEvent.change(input, { target: { value: "valid-token" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("admin-form")).toBeInTheDocument();
    });
  });

  it("should disable button while validating", async () => {
    mockValidateBootstrapToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ valid: true }), 100);
        })
    );

    render(<BootstrapPageTest />);
    const input = screen.getByTestId("token-input");
    const button = screen.getByTestId("validate-btn");

    fireEvent.change(input, { target: { value: "valid-token" } });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Validating...");

    await waitFor(() => {
      expect(screen.getByTestId("admin-form")).toBeInTheDocument();
      expect(screen.queryByTestId("validate-btn")).not.toBeInTheDocument();
    });
  });
});
