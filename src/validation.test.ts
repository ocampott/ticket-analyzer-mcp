import { describe, expect, it } from "@jest/globals";
import { assertFiniteInteger, optionalFiniteInteger } from "./validation.js";

describe("numeric validation", () => {
  it("rejects non-finite, fractional, and out-of-range values", () => {
    expect(() => assertFiniteInteger(Number.NaN, "limit", { min: 1, max: 10 })).toThrow(/finite integer/);
    expect(() => assertFiniteInteger(1.5, "limit", { min: 1, max: 10 })).toThrow(/finite integer/);
    expect(() => assertFiniteInteger(11, "limit", { min: 1, max: 10 })).toThrow(/between 1 and 10/);
  });

  it("accepts undefined optional values and validates supplied values", () => {
    expect(optionalFiniteInteger(undefined, "limit", { min: 0, max: 10 })).toBeUndefined();
    expect(optionalFiniteInteger(0, "limit", { min: 0, max: 10 })).toBe(0);
  });
});
