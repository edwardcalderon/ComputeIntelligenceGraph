import {
  resolveDashboardUrl,
  resolveLandingLoggedOutUrl,
  resolveLandingUrl,
} from "../siteUrl";

describe("siteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalDashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }

    if (originalDashboardUrl === undefined) {
      delete process.env.NEXT_PUBLIC_DASHBOARD_URL;
    } else {
      process.env.NEXT_PUBLIC_DASHBOARD_URL = originalDashboardUrl;
    }
  });

  it("uses localhost landing when the dashboard runs on loopback", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cig.lat";

    expect(
      resolveLandingUrl({ hostname: "localhost", protocol: "http:" }),
    ).toBe("http://localhost:3000");
    expect(
      resolveLandingLoggedOutUrl({ hostname: "localhost", protocol: "http:" }),
    ).toBe("http://localhost:3000?logged_out=1");
  });

  it("falls back to the configured site url on production hosts", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cig.lat";

    expect(
      resolveLandingUrl({ hostname: "app.cig.lat", protocol: "https:" }),
    ).toBe("https://cig.lat");
  });

  it("uses localhost dashboard when the dashboard runs on loopback", () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://app.cig.lat";

    expect(
      resolveDashboardUrl({ hostname: "localhost", protocol: "http:" }),
    ).toBe("http://localhost:3001");
  });

  it("falls back to the configured dashboard url on production hosts", () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://app.cig.lat";

    expect(
      resolveDashboardUrl({ hostname: "app.cig.lat", protocol: "https:" }),
    ).toBe("https://app.cig.lat");
  });
});
