export interface IntegerBounds {
  min: number;
  max: number;
}

export function assertFiniteInteger(value: unknown, name: string, bounds: IntegerBounds): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${name} must be a finite integer`);
  }
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}`);
  }
  return value;
}

export function optionalFiniteInteger(
  value: unknown,
  name: string,
  bounds: IntegerBounds,
): number | undefined {
  return value === undefined ? undefined : assertFiniteInteger(value, name, bounds);
}
