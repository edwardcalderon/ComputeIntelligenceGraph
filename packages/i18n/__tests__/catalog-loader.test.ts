import { describe, it, expect } from "vitest";
import { staticLoader } from "../src/catalog-loader.js";

describe("staticLoader", () => {
  const loader = staticLoader({
    en: { hello: "Hello" },
    es: { hello: "Hola" },
  });

  it("returns the correct catalog for a locale", () => {
    expect(loader("en")).toEqual({ hello: "Hello" });
    expect(loader("es")).toEqual({ hello: "Hola" });
  });

  it("throws for missing locale", () => {
    expect(() => loader("zh")).toThrow('No catalog for locale "zh"');
  });
});
