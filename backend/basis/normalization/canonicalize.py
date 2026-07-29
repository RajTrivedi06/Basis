"""GPU SKU canonicalization.

Maps provider-specific GPU model names to a canonical SKU identifier.
For example: "NVIDIA H100 SXM5 80GB" -> "h100_sxm_80gb"

Normalization is rule-based and conservative. Only map names that are
unambiguously the same hardware. When in doubt, preserve the distinction.
"""

from dataclasses import dataclass, field

# Canonical SKU format: {model}_{form_factor}_{vram_gb}gb
# Examples: h100_sxm_80gb, a100_pcie_80gb, rtx_4090_24gb

# fmt: off
GPU_NAME_MAP: dict[str, str] = {
    # === H100 ===
    "H100 80GB":                    "h100_sxm_80gb",
    "H100 SXM":                     "h100_sxm_80gb",
    "H100_SXM5":                    "h100_sxm_80gb",
    "H100 SXM5 80GB":              "h100_sxm_80gb",
    "H100 NVL":                     "h100_nvl_94gb",
    "H100 PCIe":                    "h100_pcie_80gb",
    "H100 PCIE":                    "h100_pcie_80gb",

    # === H200 ===
    "H200":                         "h200_sxm_141gb",
    "H200 SXM":                     "h200_sxm_141gb",
    "H200 NVL":                     "h200_nvl_141gb",
    "NVIDIA H200 NVL":              "h200_nvl_141gb",

    # === B200 / B300 ===
    "B200":                         "b200_sxm_192gb",
    "B300":                         "b300_sxm_288gb",

    # === A100 ===
    "A100 80GB":                    "a100_sxm_80gb",
    "A100":                         "a100_sxm_40gb",
    "A100 SXM":                     "a100_sxm_80gb",
    "A100 SXM4":                    "a100_sxm_80gb",
    "A100 SXM 80GB":               "a100_sxm_80gb",
    "NVIDIA A100 SXM4 80GB":       "a100_sxm_80gb",
    "A100 SXM 40GB":               "a100_sxm_40gb",
    "A100 PCIE":                    "a100_pcie_80gb",
    "A100 PCIe":                    "a100_pcie_80gb",
    "A100X":                        "a100_pcie_80gb",
    "A800 PCIE":                    "a800_pcie_80gb",

    # === A40 / A10 ===
    "A40":                          "a40_pcie_48gb",
    "a40-pcie-48gb":                "a40_pcie_48gb",
    "A10":                          "a10_pcie_24gb",
    "A10g":                         "a10g_pcie_24gb",
    "A10G":                         "a10g_pcie_24gb",

    # === L40 / L40S / L4 ===
    "L40":                          "l40_pcie_48gb",
    "L40S":                         "l40s_pcie_48gb",
    "NVIDIA L40S PCIe 48GB":       "l40s_pcie_48gb",
    "L4":                           "l4_pcie_24gb",
    "NVIDIA L4 PCIe 24GB":         "l4_pcie_24gb",
    "T4":                           "t4_pcie_16gb",

    # === RTX 4090 ===
    "RTX 4090":                     "rtx_4090_24gb",
    "NVIDIA GeForce RTX 4090 PCIe 24GB": "rtx_4090_24gb",
    "RTX 4090D":                    "rtx_4090d_24gb",

    # === RTX 5090 ===
    "RTX 5090":                     "rtx_5090_32gb",
    "geforcertx5090-pcie-32gb":     "rtx_5090_32gb",

    # === RTX 5080 / 5070 / 5060 ===
    "RTX 5080":                     "rtx_5080_16gb",
    "RTX 5070 Ti":                  "rtx_5070ti_16gb",
    "RTX 5070":                     "rtx_5070_12gb",
    "RTX 5060 Ti":                  "rtx_5060ti_16gb",
    "RTX 5060":                     "rtx_5060_16gb",

    # === RTX 4080 / 4070 / 4060 ===
    "RTX 4080":                     "rtx_4080_16gb",
    "RTX 4080 SUPER":              "rtx_4080s_16gb",
    "RTX 4080S":                    "rtx_4080s_16gb",
    "NVIDIA GeForce RTX 4080 PCIe 16GB": "rtx_4080_16gb",
    "RTX 4070 Ti":                  "rtx_4070ti_12gb",
    "RTX 4070S Ti":                 "rtx_4070sti_16gb",
    "RTX 4070":                     "rtx_4070_12gb",
    "RTX 4070S":                    "rtx_4070s_12gb",
    "RTX 4060 Ti":                  "rtx_4060ti_16gb",
    "RTX 4060":                     "rtx_4060_8gb",

    # === RTX 3090 / 3080 / 3070 / 3060 ===
    "RTX 3090":                     "rtx_3090_24gb",
    "NVIDIA GeForce RTX 3090 PCIe 24GB": "rtx_3090_24gb",
    "RTX 3090 Ti":                  "rtx_3090ti_24gb",
    "RTX 3080 Ti":                  "rtx_3080ti_12gb",
    "RTX 3080":                     "rtx_3080_10gb",
    "RTX 3070 Ti":                  "rtx_3070ti_8gb",
    "RTX 3070":                     "rtx_3070_8gb",
    "RTX 3060 Ti":                  "rtx_3060ti_8gb",
    "RTX 3060":                     "rtx_3060_12gb",
    "RTX 3060 laptop":             "rtx_3060_laptop_6gb",
    "RTX 3050":                     "rtx_3050_8gb",

    # === RTX 2000 series ===
    "RTX 2080 Ti":                  "rtx_2080ti_11gb",
    "RTX 2080S":                    "rtx_2080s_8gb",
    "RTX 2070S":                    "rtx_2070s_8gb",
    "RTX 2070":                     "rtx_2070_8gb",
    "RTX 2060S":                    "rtx_2060s_6gb",
    "RTX 2060":                     "rtx_2060_6gb",

    # === RTX Professional / Workstation ===
    "RTX A6000":                    "rtx_a6000_48gb",
    "NVIDIA RTX A6000 PCIe 48GB":  "rtx_a6000_48gb",
    "RTX 6000Ada":                  "rtx_6000ada_48gb",
    "RTX 6000 Ada":                 "rtx_6000ada_48gb",
    "NVIDIA RTX 6000 ADA PCIe 48GB": "rtx_6000ada_48gb",
    "RTX A5000":                    "rtx_a5000_24gb",
    "NVIDIA RTX A5000 PCIe 24GB":  "rtx_a5000_24gb",
    "RTX 5000 Ada":                 "rtx_5000ada_32gb",
    "NVIDIA RTX 5000 ADA PCIe 32GB": "rtx_5000ada_32gb",
    "RTX 5000Ada":                  "rtx_5000ada_32gb",
    "RTX A4500":                    "rtx_a4500_20gb",
    "RTX 4500Ada":                  "rtx_4500ada_24gb",
    "RTX A4000":                    "rtx_a4000_16gb",
    "NVIDIA RTX A4000 PCIe 16GB":  "rtx_a4000_16gb",
    "RTX 4000 Ada":                 "rtx_4000ada_20gb",
    "RTX 4000 Ada SFF":            "rtx_4000ada_20gb",
    "RTX 4000Ada":                  "rtx_4000ada_20gb",
    "RTX A2000":                    "rtx_a2000_6gb",
    "RTX 2000 Ada":                 "rtx_2000ada_16gb",
    "RTX 2000Ada":                  "rtx_2000ada_16gb",

    # === RTX PRO (Blackwell workstation) ===
    "RTX PRO 6000 WS":             "rtx_pro6000_96gb",
    "RTX PRO 6000 WK":             "rtx_pro6000_96gb",
    "RTX PRO 6000":                 "rtx_pro6000_96gb",
    "RTX PRO 6000 S":              "rtx_pro6000s_96gb",
    "RTX PRO 6000 MaxQ":           "rtx_pro6000_maxq_96gb",
    "RTX PRO 5000":                 "rtx_pro5000_32gb",
    "RTX PRO 4500":                 "rtx_pro4500_24gb",
    "RTX PRO 4000":                 "rtx_pro4000_20gb",

    # === RTX 5880 Ada ===
    "RTX 5880Ada":                  "rtx_5880ada_48gb",

    # === Quadro / Old Professional ===
    "Q RTX 8000":                   "quadro_rtx8000_48gb",
    "Q RTX 6000":                   "quadro_rtx6000_24gb",
    "Q RTX 5000":                   "quadro_rtx5000_16gb",
    "Q RTX 4000":                   "quadro_rtx4000_8gb",
    "Quadro P4000":                 "quadro_p4000_8gb",
    "Quadro P2000":                 "quadro_p2000_5gb",

    # === Titan ===
    "Titan RTX":                    "titan_rtx_24gb",
    "Titan Xp":                     "titan_xp_12gb",
    "Titan V":                      "titan_v_12gb",

    # === Tesla (data center, older) ===
    "Tesla V100":                   "v100_pcie_16gb",
    "V100":                         "v100_pcie_16gb",
    "V100 SXM2":                    "v100_sxm2_16gb",
    "NVIDIA Tesla V100 SXM2 16GB": "v100_sxm2_16gb",
    "NVIDIA Tesla V100 SXM3 32GB": "v100_sxm3_32gb",
    "Tesla T4":                     "t4_pcie_16gb",
    "Tesla P100":                   "p100_pcie_16gb",
    "P100":                         "p100_pcie_16gb",
    "Tesla P40":                    "p40_pcie_24gb",
    "Tesla P4":                     "p4_pcie_8gb",
    "Tesla M40":                    "m40_pcie_12gb",

    # === GTX ===
    "GTX 1080 Ti":                  "gtx_1080ti_11gb",
    "GTX 1080":                     "gtx_1080_8gb",
    "GTX 1070 Ti":                  "gtx_1070ti_8gb",
    "GTX 1070":                     "gtx_1070_8gb",
    "GTX 1060":                     "gtx_1060_6gb",
    "GTX 1050 Ti":                  "gtx_1050ti_4gb",
    "GTX 1050":                     "gtx_1050_2gb",
    "GTX 1660 Ti":                  "gtx_1660ti_6gb",
    "GTX 1660 S":                   "gtx_1660s_6gb",
    "GTX 1660":                     "gtx_1660_6gb",
    "GTX 1650 S":                   "gtx_1650s_4gb",
    "GTX 1650":                     "gtx_1650_4gb",

    # === AMD ===
    "MI300X":                       "mi300x_192gb",

    # === Misc ===
    "P106-100":                     "p106_100_6gb",
}
# fmt: on


# GPU variant extraction (SXM vs PCIe)
_SXM_SKUS = {s for s in GPU_NAME_MAP.values() if "_sxm" in s}
_PCIE_SKUS = {s for s in GPU_NAME_MAP.values() if "_pcie" in s}


def canonicalize_gpu(reported_name: str) -> str | None:
    """Map a provider-reported GPU name to a canonical SKU.

    Returns None if the name is not in our mapping table.
    """
    return GPU_NAME_MAP.get(reported_name)


def get_gpu_variant(canonical_sku: str) -> str | None:
    """Extract the form factor variant from a canonical SKU."""
    if canonical_sku in _SXM_SKUS:
        return "sxm"
    if canonical_sku in _PCIE_SKUS:
        return "pcie"
    if "nvl" in canonical_sku:
        return "nvl"
    return None


def get_vram_gb(canonical_sku: str) -> int | None:
    """Extract VRAM in GB from a canonical SKU name."""
    # SKU format ends with _XYZgb
    parts = canonical_sku.rsplit("_", 1)
    if len(parts) == 2 and parts[1].endswith("gb"):
        try:
            return int(parts[1][:-2])
        except ValueError:
            pass
    return None


@dataclass
class GpuCanonicalizationExplanation:
    """Attribution for GPU name → canonical SKU normalization (read-path only).

    Produced by `explain_canonicalize_gpu`. Never consumed by the write path;
    see ADR 0004 for the write-path safety invariant.
    """

    reported_name: str
    matched: bool
    canonical_sku: str | None
    gpu_variant: str | None
    vram_gb: int | None
    rules: list[str] = field(default_factory=list)


def explain_canonicalize_gpu(reported_name: str) -> GpuCanonicalizationExplanation:
    """Return attribution for the canonicalize_gpu decision on a given input.

    Mirrors the lookups in `canonicalize_gpu`, `get_gpu_variant`, and
    `get_vram_gb`, recording each rule applied. Does not mutate state;
    read-path only.
    """
    rules: list[str] = []
    canonical_sku = GPU_NAME_MAP.get(reported_name)
    if canonical_sku is None:
        rules.append(f"GPU_NAME_MAP[{reported_name!r}] -> no match")
        return GpuCanonicalizationExplanation(
            reported_name=reported_name,
            matched=False,
            canonical_sku=None,
            gpu_variant=None,
            vram_gb=None,
            rules=rules,
        )

    rules.append(f"GPU_NAME_MAP[{reported_name!r}] -> {canonical_sku!r}")

    variant = get_gpu_variant(canonical_sku)
    if variant == "sxm":
        rules.append("variant: 'sxm' (canonical SKU contains '_sxm')")
    elif variant == "pcie":
        rules.append("variant: 'pcie' (canonical SKU contains '_pcie')")
    elif variant == "nvl":
        rules.append("variant: 'nvl' (canonical SKU contains 'nvl')")
    else:
        rules.append("variant: None (no known form factor marker in SKU)")

    vram = get_vram_gb(canonical_sku)
    if vram is not None:
        rules.append(f"vram_gb: {vram} (parsed from '{canonical_sku}' suffix)")
    else:
        rules.append(f"vram_gb: None (could not parse suffix of '{canonical_sku}')")

    return GpuCanonicalizationExplanation(
        reported_name=reported_name,
        matched=True,
        canonical_sku=canonical_sku,
        gpu_variant=variant,
        vram_gb=vram,
        rules=rules,
    )
