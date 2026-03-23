import {
  resolveLandingLoggedOutUrl,
  resolveLandingUrl,
} from "../siteUrl";

describe("siteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
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
});
