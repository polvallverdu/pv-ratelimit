import { describe, it, expect } from "vitest";
import { getKey } from "../../src/utils/key";

describe("getKey", () => {
  it("should join type, name, and id", () => {
    expect(getKey("type", "name", "id")).toBe("type:name:id");
  });

  it("should append extra if provided", () => {
    expect(getKey("type", "name", "id", "extra")).toBe("type:name:id:extra");
  });

  it("should handle empty extra", () => {
    expect(getKey("type", "name", "id", "")).toBe("type:name:id");
  });

  it("should handle empty id", () => {
    expect(getKey("type", "name", "")).toBe("type:name:");
  });

  it("should handle empty name", () => {
    expect(getKey("type", "", "id")).toBe("type::id");
  });

  it("should handle empty type", () => {
    expect(getKey("", "name", "id")).toBe(":name:id");
  });

  it("should handle all empty", () => {
    expect(getKey("", "", "")).toBe("::");
  });
});
