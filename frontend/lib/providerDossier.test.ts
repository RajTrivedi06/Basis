import { describe, expect, it } from "vitest";
import { providerDossier, deltaClause } from "@/lib/providerDossier";

describe("providerDossier", () => {
  it("returns filed copy for known subjects", () => {
    expect(providerDossier("vast").file).toBe("BS-04-VAST");
    expect(providerDossier("aws_spot").role).toMatch(/hyperscaler/i);
  });

  it("falls back without inventing figures for unknown keys", () => {
    const unknown = providerDossier("newcloud");
    expect(unknown.file).toBe("BS-04-NEWC");
    expect(unknown.role).toMatch(/not yet filed/i);
    expect(unknown.dossier).toMatch(/GET \/api\/providers/);
  });
});

describe("deltaClause — prose can never contradict the figure", () => {
  it("reads parity at exactly zero, not 'below'", () => {
    expect(deltaClause(0)).toMatch(/level with the market median/i);
    expect(deltaClause(0)).not.toMatch(/above|below/i);
  });

  it("follows the live sign", () => {
    expect(deltaClause(12.4)).toMatch(/above the market median.*12\.4%/i);
    expect(deltaClause(-7.1)).toMatch(/below the market median.*7\.1%/i);
  });

  it("files nothing when there is no deviation to file", () => {
    expect(deltaClause(null)).toMatch(/no deviation is filed/i);
  });
});

describe("static dossiers hold no directional or staleness claims", () => {
  it("never asserts a market direction in frozen copy", () => {
    for (const key of ["vast", "runpod", "aws_spot", "azure", "gcp", "tensordock"]) {
      const { dossier } = providerDossier(key);
      expect(dossier).not.toMatch(/sits (above|below|just under)/i);
      expect(dossier).not.toMatch(/no successful collection in seven days/i);
      expect(dossier).not.toMatch(/largest contributor/i);
    }
  });

  it("files no dossier for sources we deliberately do not collect (ADR-0003)", () => {
    // Lambda Labs was dropped for requiring a payment method.
    expect(providerDossier("lambda").role).toMatch(/not yet filed/i);
  });
});
