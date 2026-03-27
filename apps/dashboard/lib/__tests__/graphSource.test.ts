import {
  buildResourceHref,
  normalizeGraphSource,
  resolveInitialGraphSource,
  shouldAutoUseDemoGraphSource,
} from "../graphSource";

describe("graphSource", () => {
  it("normalizes unknown values to live", () => {
    expect(normalizeGraphSource(undefined)).toBe("live");
    expect(normalizeGraphSource("demo")).toBe("demo");
    expect(normalizeGraphSource("anything-else")).toBe("live");
  });

  it("builds demo resource links with a source query", () => {
    expect(buildResourceHref("res-1", "demo")).toBe("/resources/res-1?source=demo");
    expect(buildResourceHref("res-1", "live")).toBe("/resources/res-1");
  });

  it("resolves the initial source safely from missing input", () => {
    expect(resolveInitialGraphSource(undefined)).toBe("live");
    expect(resolveInitialGraphSource("demo")).toBe("demo");
  });

  it("auto-selects the demo source on loopback when live data is unavailable", () => {
    expect(
      shouldAutoUseDemoGraphSource("localhost", "live", {
        source: { kind: "live", available: false, lastSyncedAt: null },
        resources: [],
      } as any),
    ).toBe(true);

    expect(
      shouldAutoUseDemoGraphSource("localhost", "demo", {
        source: { kind: "demo", available: true, lastSyncedAt: null },
        resources: [{ id: "demo-1" }],
      } as any),
    ).toBe(false);

    expect(
      shouldAutoUseDemoGraphSource("app.cig.lat", "live", {
        source: { kind: "live", available: false, lastSyncedAt: null },
        resources: [],
      } as any),
    ).toBe(false);
  });
});
