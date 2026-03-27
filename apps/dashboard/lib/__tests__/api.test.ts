import { getGraphSnapshot } from "../api";
import { getDashboardClient } from "../cigClient";

jest.mock("../cigClient", () => ({
  getDashboardClient: jest.fn(),
}));

const mockGetDashboardClient = getDashboardClient as jest.MockedFunction<
  typeof getDashboardClient
>;

describe("dashboard api graph snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers the demo snapshot compatibility route and falls back to the legacy source query", async () => {
    const makeResponse = (status: number, body: unknown) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 404 ? "Not Found" : "OK",
        text: async () => JSON.stringify(body),
        json: async () => body,
      }) as Response;

    const requestRaw = jest
      .fn()
      .mockResolvedValueOnce(
        makeResponse(404, { error: "Not found", statusCode: 404 }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          source: {
            kind: "demo",
            available: true,
            lastSyncedAt: "2026-03-27T00:00:00.000Z",
          },
          resourceCounts: {},
          resources: [],
          relationships: [],
          discovery: {
            healthy: true,
            running: false,
            lastRun: "2026-03-27T00:00:00.000Z",
            nextRun: null,
          },
        }),
      );

    mockGetDashboardClient.mockReturnValue({
      requestRaw,
      getGraphSnapshot: jest.fn(),
    } as never);

    const snapshot = await getGraphSnapshot("demo");

    expect(requestRaw).toHaveBeenNthCalledWith(1, "/api/v1/demo/snapshot");
    expect(requestRaw).toHaveBeenNthCalledWith(2, "/api/v1/graph/snapshot?source=demo");
    expect(snapshot.source.kind).toBe("demo");
    expect(snapshot.source.available).toBe(true);
  });
});
