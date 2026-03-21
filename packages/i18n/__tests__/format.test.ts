import { describe, it, expect } from "vitest";
import { formatMessage } from "../src/format.js";

describe("formatMessage", () => {
  it("returns message as-is when no values", () => {
    expect(formatMessage("Hello world", undefined, "en")).toBe("Hello world");
  });

  it("returns message as-is when no placeholders", () => {
    expect(formatMessage("Hello world", { name: "test" }, "en")).toBe(
      "Hello world",
    );
  });

  it("interpolates simple variables", () => {
    expect(formatMessage("Hello {name}!", { name: "World" }, "en")).toBe(
      "Hello World!",
    );
  });

  it("interpolates multiple variables", () => {
    expect(
      formatMessage("{greeting} {name}!", { greeting: "Hi", name: "CIG" }, "en"),
    ).toBe("Hi CIG!");
  });

  it("keeps placeholder when value missing", () => {
    expect(formatMessage("Hello {name}!", {}, "en")).toBe("Hello {name}!");
  });

  it("formats numbers", () => {
    const result = formatMessage("{count, number}", { count: 1234 }, "en");
    expect(result).toBe("1,234");
  });

  it("resolves plural — one", () => {
    const msg = "{count, plural, one {# item} other {# items}}";
    expect(formatMessage(msg, { count: 1 }, "en")).toBe("1 item");
  });

  it("resolves plural — other", () => {
    const msg = "{count, plural, one {# item} other {# items}}";
    expect(formatMessage(msg, { count: 5 }, "en")).toBe("5 items");
  });

  it("resolves plural — exact match =0", () => {
    const msg = "{count, plural, =0 {No items} one {# item} other {# items}}";
    expect(formatMessage(msg, { count: 0 }, "en")).toBe("No items");
  });

  it("resolves select", () => {
    const msg = "{gender, select, male {He} female {She} other {They}}";
    expect(formatMessage(msg, { gender: "male" }, "en")).toBe("He");
    expect(formatMessage(msg, { gender: "female" }, "en")).toBe("She");
    expect(formatMessage(msg, { gender: "unknown" }, "en")).toBe("They");
  });

  it("resolves select with missing value → other", () => {
    const msg = "{role, select, admin {Admin} other {User}}";
    expect(formatMessage(msg, {}, "en")).toBe("User");
  });

  it("handles nested braces in plural body", () => {
    const msg = "{count, plural, one {There is {count} item} other {There are {count} items}}";
    expect(formatMessage(msg, { count: 3 }, "en")).toBe("There are 3 items");
  });

  it("handles Spanish plurals", () => {
    const msg = "{count, plural, one {# recurso} other {# recursos}}";
    expect(formatMessage(msg, { count: 1 }, "es")).toBe("1 recurso");
    expect(formatMessage(msg, { count: 42 }, "es")).toBe("42 recursos");
  });

  it("handles escaped single quotes", () => {
    expect(formatMessage("It''s a test", undefined, "en")).toBe("It's a test");
  });

  it("handles escaped braces", () => {
    expect(formatMessage("Use '{name}' for variables", { name: "x" }, "en")).toBe(
      "Use {name} for variables",
    );
  });
});
