/**
 * Pattern-match a canonical SKU string to a GPU family label.
 *
 * Conservative by design: unknown prefixes return null rather than a guess.
 * Callers (e.g., the fungibility matrix) hide the badge when null instead
 * of rendering "Unknown". Mirrors the backend's ADR 0002 rule for
 * normalization: don't guess at things you can't confidently resolve.
 *
 * Extend by adding a new entry below — no fuzzy matching, no lookups
 * against external data.
 */
export function gpuFamily(sku: string): string | null {
  // Data-center / modern accelerators
  if (sku.startsWith("h200")) return "Hopper";
  if (sku.startsWith("h100")) return "Hopper";
  if (sku.startsWith("b200") || sku.startsWith("b300")) return "Blackwell";
  if (sku.startsWith("a100") || sku.startsWith("a800")) return "Ampere";
  if (sku.startsWith("a40") || sku.startsWith("a10")) return "Ampere";
  // Ada-generation workstation
  if (sku.startsWith("l40") || sku.startsWith("l4_")) return "Ada";
  if (sku.includes("6000ada") || sku.includes("5000ada") || sku.includes("4500ada") || sku.includes("4000ada") || sku.includes("2000ada") || sku.includes("5880ada")) {
    return "Ada";
  }
  if (sku.startsWith("rtx_pro")) return "Blackwell";
  // RTX workstation (Ampere-generation "A"-series)
  if (sku.startsWith("rtx_a")) return "Workstation";
  // Consumer — RTX 20/30/40/50 series GeForce
  if (/^rtx_[2-5]0\d/.test(sku)) return "Consumer";
  // GTX older consumer
  if (sku.startsWith("gtx_")) return "Legacy";
  // Quadro / Titan / Tesla / pre-Ampere data-center
  if (sku.startsWith("quadro") || sku.startsWith("titan")) return "Workstation";
  if (sku.startsWith("v100")) return "Volta";
  if (sku.startsWith("t4_") || sku.startsWith("p100") || sku.startsWith("p40") || sku.startsWith("p4_") || sku.startsWith("m40")) {
    return "Legacy";
  }
  // AMD
  if (sku.startsWith("mi")) return "AMD";
  // Misc
  if (sku.startsWith("p106")) return "Legacy";

  return null;
}
