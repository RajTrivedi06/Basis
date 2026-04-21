"""Bundle decomposition.

Extracts bundled resource quantities (vCPUs, RAM, storage) from the
raw observation's provider_metadata. Different providers store this
information differently.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class BundleInfo:
    vcpus: int | None = None
    ram_gb: float | None = None
    storage_gb: float | None = None
    networking_type: str | None = None
    verification_tier: str | None = None


def extract_bundle(source: str, provider_metadata: dict | None) -> BundleInfo:
    """Extract bundled resources from provider metadata.

    Args:
        source: provider identifier
        provider_metadata: the metadata dict stored alongside the raw observation

    Returns:
        BundleInfo with whatever resource info is available.
    """
    if not provider_metadata:
        return BundleInfo()

    if source == "vast":
        return _extract_vast_bundle(provider_metadata)
    elif source == "tensordock":
        return _extract_tensordock_bundle(provider_metadata)
    elif source == "aws_spot":
        return _extract_aws_bundle(provider_metadata)
    else:
        return BundleInfo()


def _extract_vast_bundle(meta: dict) -> BundleInfo:
    """Extract bundle info from Vast.ai provider metadata."""
    cpu_ram_mb = meta.get("cpu_ram_mb")
    ram_gb = cpu_ram_mb / 1024.0 if cpu_ram_mb else None

    verification = meta.get("verification")
    if verification == "verified":
        tier = "verified"
    elif verification == "unverified":
        tier = "unverified"
    else:
        tier = verification

    return BundleInfo(
        vcpus=_to_int(meta.get("cpu_cores_effective")),
        ram_gb=round(ram_gb, 1) if ram_gb else None,
        storage_gb=_to_float(meta.get("disk_space_gb")),
        verification_tier=tier,
    )


def _extract_tensordock_bundle(meta: dict) -> BundleInfo:
    """Extract bundle info from TensorDock provider metadata."""
    return BundleInfo(
        vcpus=meta.get("max_vcpus"),
        ram_gb=meta.get("max_ram_gb"),
        storage_gb=meta.get("max_storage_gb"),
    )


def _extract_aws_bundle(meta: dict) -> BundleInfo:
    """Extract bundle info from AWS Spot provider metadata.

    AWS bundles are fixed per instance type, but we don't store the full
    instance spec. We just note what we have.
    """
    return BundleInfo(
        vcpus=None,  # Would need instance type -> vCPU lookup
        ram_gb=None,
        storage_gb=None,
    )


def _to_int(val) -> int | None:
    """Safely convert a value to int."""
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _to_float(val) -> float | None:
    """Safely convert a value to float."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


@dataclass
class BundleFieldProvenance:
    """Per-field provenance for one canonical bundle field."""

    canonical_field: str          # e.g., "ram_gb"
    source_field: str | None      # e.g., "cpu_ram_mb" — the metadata key read
    source_value: Any = None      # raw value from provider metadata
    result: Any = None            # value written to BundleInfo
    transformation: str | None = None  # e.g., "cpu_ram_mb / 1024.0"


@dataclass
class BundleExtractionExplanation:
    """Attribution for bundle extraction (read-path only).

    Produced by `explain_extract_bundle`. Never consumed by the write
    path; see ADR 0004.

    `branch` names the source-specific extractor taken: "vast",
    "tensordock", "aws_spot", "empty" (no metadata), or "unsupported".
    """

    source: str
    branch: str
    vcpus: int | None
    ram_gb: float | None
    storage_gb: float | None
    networking_type: str | None
    verification_tier: str | None
    fields: list[BundleFieldProvenance] = field(default_factory=list)


def explain_extract_bundle(
    source: str, provider_metadata: dict | None
) -> BundleExtractionExplanation:
    """Return attribution for the extract_bundle decision."""
    if not provider_metadata:
        return BundleExtractionExplanation(
            source=source,
            branch="empty",
            vcpus=None,
            ram_gb=None,
            storage_gb=None,
            networking_type=None,
            verification_tier=None,
            fields=[],
        )

    if source == "vast":
        return _explain_vast_bundle(provider_metadata)
    if source == "tensordock":
        return _explain_tensordock_bundle(provider_metadata)
    if source == "aws_spot":
        return _explain_aws_bundle(provider_metadata)

    return BundleExtractionExplanation(
        source=source,
        branch="unsupported",
        vcpus=None,
        ram_gb=None,
        storage_gb=None,
        networking_type=None,
        verification_tier=None,
        fields=[],
    )


def _explain_vast_bundle(meta: dict) -> BundleExtractionExplanation:
    fields: list[BundleFieldProvenance] = []

    raw_ram_mb = meta.get("cpu_ram_mb")
    ram_gb = raw_ram_mb / 1024.0 if raw_ram_mb else None
    ram_gb_rounded = round(ram_gb, 1) if ram_gb else None
    fields.append(
        BundleFieldProvenance(
            canonical_field="ram_gb",
            source_field="cpu_ram_mb",
            source_value=raw_ram_mb,
            result=ram_gb_rounded,
            transformation="round(cpu_ram_mb / 1024.0, 1)",
        )
    )

    raw_vcpus = meta.get("cpu_cores_effective")
    vcpus = _to_int(raw_vcpus)
    fields.append(
        BundleFieldProvenance(
            canonical_field="vcpus",
            source_field="cpu_cores_effective",
            source_value=raw_vcpus,
            result=vcpus,
            transformation="int(float(cpu_cores_effective))",
        )
    )

    raw_storage = meta.get("disk_space_gb")
    storage = _to_float(raw_storage)
    fields.append(
        BundleFieldProvenance(
            canonical_field="storage_gb",
            source_field="disk_space_gb",
            source_value=raw_storage,
            result=storage,
            transformation="float(disk_space_gb)",
        )
    )

    raw_verification = meta.get("verification")
    if raw_verification == "verified":
        tier = "verified"
    elif raw_verification == "unverified":
        tier = "unverified"
    else:
        tier = raw_verification
    fields.append(
        BundleFieldProvenance(
            canonical_field="verification_tier",
            source_field="verification",
            source_value=raw_verification,
            result=tier,
            transformation="identity with known-value pass-through",
        )
    )

    return BundleExtractionExplanation(
        source="vast",
        branch="vast",
        vcpus=vcpus,
        ram_gb=ram_gb_rounded,
        storage_gb=storage,
        networking_type=None,
        verification_tier=tier,
        fields=fields,
    )


def _explain_tensordock_bundle(meta: dict) -> BundleExtractionExplanation:
    fields: list[BundleFieldProvenance] = []
    vcpus = meta.get("max_vcpus")
    ram_gb = meta.get("max_ram_gb")
    storage_gb = meta.get("max_storage_gb")
    fields.append(
        BundleFieldProvenance(
            canonical_field="vcpus",
            source_field="max_vcpus",
            source_value=vcpus,
            result=vcpus,
            transformation="identity",
        )
    )
    fields.append(
        BundleFieldProvenance(
            canonical_field="ram_gb",
            source_field="max_ram_gb",
            source_value=ram_gb,
            result=ram_gb,
            transformation="identity",
        )
    )
    fields.append(
        BundleFieldProvenance(
            canonical_field="storage_gb",
            source_field="max_storage_gb",
            source_value=storage_gb,
            result=storage_gb,
            transformation="identity",
        )
    )
    return BundleExtractionExplanation(
        source="tensordock",
        branch="tensordock",
        vcpus=vcpus,
        ram_gb=ram_gb,
        storage_gb=storage_gb,
        networking_type=None,
        verification_tier=None,
        fields=fields,
    )


def _explain_aws_bundle(_meta: dict) -> BundleExtractionExplanation:
    # AWS extraction currently yields no canonical fields (see extract_bundle:
    # bundle spec would need instance-type -> vCPU lookup that we don't have).
    return BundleExtractionExplanation(
        source="aws_spot",
        branch="aws_spot",
        vcpus=None,
        ram_gb=None,
        storage_gb=None,
        networking_type=None,
        verification_tier=None,
        fields=[
            BundleFieldProvenance(
                canonical_field="vcpus",
                source_field=None,
                source_value=None,
                result=None,
                transformation="unavailable: AWS Spot collector does not store instance-type->vCPU lookup",
            ),
            BundleFieldProvenance(
                canonical_field="ram_gb",
                source_field=None,
                source_value=None,
                result=None,
                transformation="unavailable: same as vcpus",
            ),
            BundleFieldProvenance(
                canonical_field="storage_gb",
                source_field=None,
                source_value=None,
                result=None,
                transformation="unavailable: same as vcpus",
            ),
        ],
    )
