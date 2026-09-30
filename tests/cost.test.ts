import { describe, expect, it } from "vitest";
import { calculateCostMicroCents, microToCents } from "../src/lib/cost";

describe("Kostenberechnung", () => {
  it("Haiku: 1 Mio Input = 100 Cent, 1 Mio Output = 500 Cent", () => {
    const m = "claude-haiku-4-5-20251001";
    expect(microToCents(calculateCostMicroCents(m, { input_tokens: 1_000_000, output_tokens: 0 }))).toBe(100);
    expect(microToCents(calculateCostMicroCents(m, { input_tokens: 0, output_tokens: 1_000_000 }))).toBe(500);
  });
  it("Sonnet 5.5: 200 Cent Input, 1000 Cent Output pro Million", () => {
    const m = "claude-sonnet-5-5";
    expect(microToCents(calculateCostMicroCents(m, { input_tokens: 1_000_000, output_tokens: 1_000_000 }))).toBe(1200);
  });
  it("rechnet Cache-Tokens mit eigenen Preisen", () => {
    const c = calculateCostMicroCents("claude-sonnet-5-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(microToCents(c)).toBe(270); // 250 + 20
  });
  it("kleine Anfrage: 1000 Input + 500 Output bei Haiku = 0,35 Cent", () => {
    const c = calculateCostMicroCents("claude-haiku-4-5-20251001", { input_tokens: 1000, output_tokens: 500 });
    expect(microToCents(c)).toBeCloseTo(0.35, 10);
  });
  it("fehlende Cache-Felder (null/undefined) zählen als 0", () => {
    const c = calculateCostMicroCents("claude-haiku-4-5-20251001", {
      input_tokens: 10,
      output_tokens: 0,
      cache_creation_input_tokens: null,
    });
    expect(c).toBe(1000);
  });
  it("wirft bei unbekanntem Modell", () => {
    // @ts-expect-error absichtlich falsch
    expect(() => calculateCostMicroCents("gibt-es-nicht", { input_tokens: 1, output_tokens: 1 })).toThrow();
  });
});
