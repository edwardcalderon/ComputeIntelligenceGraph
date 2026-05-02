import {
  getGpuSessions,
  getGpuSession,
  createGpuSession,
  deleteGpuSession,
  restartGpuWorker,
  getGpuHealth,
  getGpuLogs,
  getGpuConfig,
  getGpuActivity,
} from "../../lib/gpuApi";
import type { GpuSessionCreateRequest } from "../../types/gpu";

// ---------------------------------------------------------------------------
// Mock getDashboardClient
// ---------------------------------------------------------------------------

const mockRequest = jest.fn();

jest.mock("../../lib/cigClient", () => ({
  getDashboardClient: () => ({ request: mockRequest }),
}));

beforeEach(() => {
  mockRequest.mockReset();
});

// ---------------------------------------------------------------------------
// getGpuSessions
// ---------------------------------------------------------------------------

describe("getGpuSessions", () => {
  it("calls request with the sessions URL and no query params when params is undefined", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await getGpuSessions();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/sessions");
  });

  it("appends query params when provided", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await getGpuSessions("status=running&limit=10");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/sessions?status=running&limit=10",
    );
  });

  it("returns the typed PaginatedResponse", async () => {
    const expected = {
      items: [{ sessionId: "s1", status: "running" }],
      total: 1,
      limit: 50,
      offset: 0,
    };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuSessions();
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getGpuSession
// ---------------------------------------------------------------------------

describe("getGpuSession", () => {
  it("calls request with the correct URL including encoded session ID", async () => {
    mockRequest.mockResolvedValue({ sessionId: "abc-123" });

    await getGpuSession("abc-123");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/sessions/abc-123",
    );
  });

  it("encodes special characters in session ID", async () => {
    mockRequest.mockResolvedValue({ sessionId: "a/b c" });

    await getGpuSession("a/b c");

    expect(mockRequest).toHaveBeenCalledWith(
      `/api/v1/gpu/sessions/${encodeURIComponent("a/b c")}`,
    );
  });

  it("returns the typed GpuSessionDetail", async () => {
    const expected = { sessionId: "s1", status: "running", models: ["llama3"] };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuSession("s1");
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// createGpuSession
// ---------------------------------------------------------------------------

describe("createGpuSession", () => {
  it("sends a POST request with JSON-serialized body", async () => {
    const payload: GpuSessionCreateRequest = {
      provider: "colab",
      modelNames: ["llama3", "mistral"],
    };
    mockRequest.mockResolvedValue({ sessionId: "new-1", status: "creating" });

    await createGpuSession(payload);

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("includes configOverrides when provided", async () => {
    const payload: GpuSessionCreateRequest = {
      provider: "local",
      modelNames: ["phi3"],
      configOverrides: { GPU_MEMORY: "8GB" },
    };
    mockRequest.mockResolvedValue({ sessionId: "new-2", status: "creating" });

    await createGpuSession(payload);

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("returns the created GpuSession", async () => {
    const payload: GpuSessionCreateRequest = {
      provider: "colab",
      modelNames: ["llama3"],
    };
    const expected = { sessionId: "new-1", status: "creating" };
    mockRequest.mockResolvedValue(expected);

    const result = await createGpuSession(payload);
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// deleteGpuSession
// ---------------------------------------------------------------------------

describe("deleteGpuSession", () => {
  it("sends a DELETE request with the correct URL", async () => {
    mockRequest.mockResolvedValue(undefined);

    await deleteGpuSession("sess-42");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/sessions/sess-42",
      { method: "DELETE" },
    );
  });

  it("encodes special characters in session ID", async () => {
    mockRequest.mockResolvedValue(undefined);

    await deleteGpuSession("sess/special id");

    expect(mockRequest).toHaveBeenCalledWith(
      `/api/v1/gpu/sessions/${encodeURIComponent("sess/special id")}`,
      { method: "DELETE" },
    );
  });
});

// ---------------------------------------------------------------------------
// restartGpuWorker
// ---------------------------------------------------------------------------

describe("restartGpuWorker", () => {
  it("sends a POST request to the restart-worker endpoint", async () => {
    mockRequest.mockResolvedValue(undefined);

    await restartGpuWorker("sess-42");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/sessions/sess-42/restart-worker",
      { method: "POST" },
    );
  });

  it("encodes special characters in session ID", async () => {
    mockRequest.mockResolvedValue(undefined);

    await restartGpuWorker("sess/special");

    expect(mockRequest).toHaveBeenCalledWith(
      `/api/v1/gpu/sessions/${encodeURIComponent("sess/special")}/restart-worker`,
      { method: "POST" },
    );
  });
});

// ---------------------------------------------------------------------------
// getGpuHealth
// ---------------------------------------------------------------------------

describe("getGpuHealth", () => {
  it("calls request with the health URL (GET, no params)", async () => {
    const expected = { totalHealthy: 3, totalUnhealthy: 1, totalNoData: 0, sessions: [] };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuHealth();

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/health");
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getGpuLogs
// ---------------------------------------------------------------------------

describe("getGpuLogs", () => {
  it("calls request with the logs URL and no query params when params is undefined", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await getGpuLogs();

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/logs");
  });

  it("appends query params when provided", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await getGpuLogs("level=error&limit=20");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/logs?level=error&limit=20",
    );
  });

  it("returns the typed PaginatedResponse", async () => {
    const expected = {
      items: [{ id: "log-1", level: "info", message: "test" }],
      total: 1,
      limit: 50,
      offset: 0,
    };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuLogs();
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getGpuConfig
// ---------------------------------------------------------------------------

describe("getGpuConfig", () => {
  it("calls request with the config URL (GET, no params)", async () => {
    const expected = {
      providerSettings: [],
      awsSettings: [],
      healthCheckSettings: [],
      loggingSettings: [],
    };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuConfig();

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/config");
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getGpuActivity
// ---------------------------------------------------------------------------

describe("getGpuActivity", () => {
  it("calls request with the activity URL and no query params when params is undefined", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 30, offset: 0 });

    await getGpuActivity();

    expect(mockRequest).toHaveBeenCalledWith("/api/v1/gpu/activity");
  });

  it("appends query params when provided", async () => {
    mockRequest.mockResolvedValue({ items: [], total: 0, limit: 30, offset: 0 });

    await getGpuActivity("eventType=session_created&limit=10");

    expect(mockRequest).toHaveBeenCalledWith(
      "/api/v1/gpu/activity?eventType=session_created&limit=10",
    );
  });

  it("returns the typed PaginatedResponse", async () => {
    const expected = {
      items: [{ id: "evt-1", eventType: "session_created", description: "Created" }],
      total: 1,
      limit: 30,
      offset: 0,
    };
    mockRequest.mockResolvedValue(expected);

    const result = await getGpuActivity();
    expect(result).toEqual(expected);
  });
});
