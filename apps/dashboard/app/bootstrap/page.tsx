"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BootstrapStatusResponse {
  requires_bootstrap: boolean;
}

interface BootstrapValidateResponse {
  valid: boolean;
}

interface BootstrapCompleteResponse {
  access_token: string;
  refresh_token: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getBootstrapStatus(): Promise<BootstrapStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/bootstrap/status`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function validateBootstrapToken(
  token: string
): Promise<BootstrapValidateResponse> {
  const res = await fetch(`${API_URL}/api/v1/bootstrap/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bootstrap_token: token }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? `API error ${res.status}`);
  }
  return res.json();
}

async function completeBootstrap(
  token: string,
  username: string,
  email: string,
  password: string
): Promise<BootstrapCompleteResponse> {
  const res = await fetch(`${API_URL}/api/v1/bootstrap/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bootstrap_token: token,
      username,
      email,
      password,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export default function BootstrapPage() {
  const router = useRouter();
  const [step, setStep] = useState<"token" | "admin" | "complete">("token");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requiresBootstrap, setRequiresBootstrap] = useState<boolean | null>(
    null
  );

  // Check if bootstrap is required
  useEffect(() => {
    const checkBootstrap = async () => {
      try {
        const status = await getBootstrapStatus();
        setRequiresBootstrap(status.requires_bootstrap);
        if (!status.requires_bootstrap) {
          // Bootstrap already complete, redirect to login
          router.push("/auth/login");
        }
      } catch (err) {
        console.error("Failed to check bootstrap status:", err);
      }
    };
    checkBootstrap();
  }, [router]);

  const handleValidateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await validateBootstrapToken(bootstrapToken);
      setStep("admin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to validate token"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await completeBootstrap(
        bootstrapToken,
        username,
        email,
        password
      );

      // Store tokens
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("refresh_token", result.refresh_token);

      setStep("complete");

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete bootstrap"
      );
    } finally {
      setLoading(false);
    }
  };

  if (requiresBootstrap === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bootstrap CIG
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Complete the initial setup of your self-hosted CIG instance
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {step === "token" && (
          <form onSubmit={handleValidateToken} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Bootstrap Token
              </label>
              <input
                type="text"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                placeholder="Enter your bootstrap token"
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {loading ? "Validating..." : "Validate Token"}
            </button>
          </form>
        )}

        {step === "admin" && (
          <form onSubmit={handleCompleteBootstrap} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin email"
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password (min. 12 characters)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Strong password"
                required
                minLength={12}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {loading ? "Creating Admin..." : "Create Admin Account"}
            </button>
          </form>
        )}

        {step === "complete" && (
          <div className="mt-6 rounded-md bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="text-sm text-green-700 dark:text-green-300">
              Bootstrap completed successfully! Redirecting to login...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
