import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE } from "../src/types.js";
import { detectBrowserLocale } from "../src/detection.js";

type BrowserGlobals = {
  search?: string;
  cookie?: string;
  htmlLang?: string;
  language?: string;
  languages?: string[];
};

function mockBrowserGlobals({
  search = "",
  cookie = "",
  htmlLang = "en",
  language = "en-US",
  languages = [language],
}: BrowserGlobals = {}) {
  vi.stubGlobal("window", { location: { search } });
  vi.stubGlobal("document", {
    cookie,
    documentElement: { lang: htmlLang },
  });
  vi.stubGlobal("navigator", { language, languages });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectBrowserLocale", () => {
  it("prefers the URL lang param", () => {
    mockBrowserGlobals({
      search: "?lang=es",
      cookie: "cig-locale=en",
      htmlLang: "en",
      language: "zh-CN",
      languages: ["zh-CN", "en-US"],
    });

    expect(detectBrowserLocale()).toBe("es");
  });

  it("prefers the persisted cookie over the browser and html lang", () => {
    mockBrowserGlobals({
      cookie: "cig-locale=zh",
      htmlLang: "en",
      language: "es-ES",
      languages: ["es-ES", "en-US"],
    });

    expect(detectBrowserLocale()).toBe("zh");
  });

  it("uses the browser locale before the static html lang fallback", () => {
    mockBrowserGlobals({
      htmlLang: "en",
      language: "es-ES",
      languages: ["es-ES", "en-US"],
    });

    expect(detectBrowserLocale()).toBe("es");
  });

  it("falls back to the html lang when browser hints are unavailable", () => {
    mockBrowserGlobals({
      htmlLang: "es",
      language: "",
      languages: [],
    });

    expect(detectBrowserLocale()).toBe("es");
  });

  it("falls back to the default locale when nothing matches", () => {
    mockBrowserGlobals({
      htmlLang: "fr",
      language: "fr-FR",
      languages: ["fr-FR"],
    });

    expect(detectBrowserLocale()).toBe(DEFAULT_LOCALE);
  });
});
