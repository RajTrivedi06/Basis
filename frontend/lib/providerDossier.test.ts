import { describe, expect, it } from "vitest";
import { providerDossier } from "@/lib/providerDossier";

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
