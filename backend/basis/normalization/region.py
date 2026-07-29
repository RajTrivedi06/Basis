"""Geographic region normalization.

Maps provider-specific region identifiers to a (country, state, city) tuple.
We normalize to country at minimum. State and city are included when clearly
identifiable from the source data.
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class NormalizedRegion:
    country: str | None = None
    state: str | None = None
    city: str | None = None


# AWS availability zones -> region info
# Format: az_prefix -> (country, state)
AWS_REGION_MAP: dict[str, tuple[str, str | None]] = {
    "us-east-1": ("US", "Virginia"),
    "us-east-2": ("US", "Ohio"),
    "us-west-1": ("US", "California"),
    "us-west-2": ("US", "Oregon"),
    "eu-west-1": ("IE", "Ireland"),
    "eu-west-2": ("GB", "London"),
    "eu-central-1": ("DE", "Frankfurt"),
    "ap-northeast-1": ("JP", "Tokyo"),
    "ap-southeast-1": ("SG", "Singapore"),
    "ap-southeast-2": ("AU", "Sydney"),
    "ap-south-1": ("IN", "Mumbai"),
    "ca-central-1": ("CA", "Montreal"),
    "sa-east-1": ("BR", "São Paulo"),
}

# Azure Resource Manager region -> (country, state/city).
# Kept to GPU-relevant commercial-cloud regions observed in the retail feed.
AZURE_REGION_MAP: dict[str, tuple[str, str | None]] = {
    "eastus": ("US", "Virginia"),
    "eastus2": ("US", "Virginia"),
    "centralus": ("US", "Iowa"),
    "northcentralus": ("US", "Illinois"),
    "southcentralus": ("US", "Texas"),
    "westus": ("US", "California"),
    "westus2": ("US", "Washington"),
    "westus3": ("US", "Arizona"),
    "canadacentral": ("CA", "Ontario"),
    "northeurope": ("IE", "Ireland"),
    "westeurope": ("NL", "Netherlands"),
    "uksouth": ("GB", "London"),
    "francecentral": ("FR", "Paris"),
    "germanywestcentral": ("DE", "Frankfurt"),
    "swedencentral": ("SE", "Gävle"),
    "polandcentral": ("PL", "Warsaw"),
    "indonesiacentral": ("ID", "Jakarta"),
    "japaneast": ("JP", "Tokyo"),
    "southeastasia": ("SG", "Singapore"),
    "australiaeast": ("AU", "New South Wales"),
    "centralindia": ("IN", "Pune"),
}

# GCP regions with GPU availability (region_id -> (country, city/state))
GCP_REGION_MAP: dict[str, tuple[str, str | None]] = {
    "us-central1": ("US", "Iowa"),
    "us-east1": ("US", "South Carolina"),
    "us-east4": ("US", "Northern Virginia"),
    "us-east5": ("US", "Columbus"),
    "us-south1": ("US", "Dallas"),
    "us-west1": ("US", "Oregon"),
    "us-west2": ("US", "Los Angeles"),
    "us-west3": ("US", "Salt Lake City"),
    "us-west4": ("US", "Las Vegas"),
    "northamerica-northeast1": ("CA", "Montreal"),
    "northamerica-northeast2": ("CA", "Toronto"),
    "southamerica-east1": ("BR", "São Paulo"),
    "europe-west1": ("BE", "St. Ghislain"),
    "europe-west2": ("GB", "London"),
    "europe-west3": ("DE", "Frankfurt"),
    "europe-west4": ("NL", "Eemshaven"),
    "europe-west6": ("CH", "Zurich"),
    "europe-west8": ("IT", "Milan"),
    "europe-west9": ("FR", "Paris"),
    "europe-west10": ("DE", "Berlin"),
    "europe-west12": ("IT", "Turin"),
    "europe-north1": ("FI", "Hamina"),
    "europe-central2": ("PL", "Warsaw"),
    "asia-east1": ("TW", "Changhua County"),
    "asia-east2": ("HK", "Hong Kong"),
    "asia-northeast1": ("JP", "Tokyo"),
    "asia-northeast2": ("JP", "Osaka"),
    "asia-northeast3": ("KR", "Seoul"),
    "asia-south1": ("IN", "Mumbai"),
    "asia-south2": ("IN", "Delhi"),
    "asia-southeast1": ("SG", "Singapore"),
    "asia-southeast2": ("ID", "Jakarta"),
    "australia-southeast1": ("AU", "Sydney"),
    "australia-southeast2": ("AU", "Melbourne"),
    "me-west1": ("IL", "Tel Aviv"),
    "me-central1": ("SA", "Dammam"),
    "me-central2": ("SA", "Dammam"),
    "africa-south1": ("ZA", "Johannesburg"),
}

# ISO-2 country codes we pass through as-is.
# Vast.ai format: "City, CC" or "State, CC" or just "CC".
_ISO2_CODES: dict[str, str] = {
    "US": "US", "CA": "CA", "GB": "GB", "UK": "GB",
    "DE": "DE", "FR": "FR", "NL": "NL", "SE": "SE",
    "NO": "NO", "FI": "FI", "PL": "PL", "CZ": "CZ",
    "AT": "AT", "CH": "CH", "IE": "IE", "ES": "ES",
    "IT": "IT", "PT": "PT", "RO": "RO", "BG": "BG",
    "JP": "JP", "KR": "KR", "SG": "SG", "AU": "AU",
    "IN": "IN", "TW": "TW", "HK": "HK", "BR": "BR",
    "IL": "IL", "AE": "AE", "ZA": "ZA", "RU": "RU",
    "TR": "TR", "TH": "TH", "VN": "VN", "MY": "MY",
    "ID": "ID", "PH": "PH", "NZ": "NZ", "MX": "MX",
    "AR": "AR", "CL": "CL", "CO": "CO", "EE": "EE",
}

# Country-name → ISO-2 mapping, applied when a source sends the full name
# (TensorDock does this). Kept conservative: only names that actually appear
# in observed data, per ADR 0002. Unknown names fall through to raw value.
_COUNTRY_NAME_TO_ISO2: dict[str, str] = {
    "United States": "US",
    "Canada": "CA",
    "Germany": "DE",
    "Czech Republic": "CZ",
    "Estonia": "EE",
    "India": "IN",
    "Romania": "RO",
}


def _country_to_iso2(value: str) -> tuple[str, str]:
    """Normalize a country indicator to ISO-2.

    Returns `(result, rule)` where `rule` is one of:
      - "iso2_match"    — input was already a known ISO-2 code
      - "name_to_iso2"  — input was a known country name; mapped to ISO-2
      - "unknown"       — input in neither table; raw value returned as-is

    The read-path behavior (pass raw value through) matches ADR 0002's
    conservative-normalization principle: we don't guess. Downstream, a
    mix of ISO-2 and raw names in `region_country` is a signal that a new
    country needs to be added to the table.
    """
    stripped = value.strip()
    if stripped in _ISO2_CODES:
        return (_ISO2_CODES[stripped], "iso2_match")
    if stripped in _COUNTRY_NAME_TO_ISO2:
        return (_COUNTRY_NAME_TO_ISO2[stripped], "name_to_iso2")
    return (stripped, "unknown")


def normalize_region(source: str, region_reported: str | None) -> NormalizedRegion:
    """Normalize a provider-specific region string to (country, state, city).

    Args:
        source: provider identifier (e.g., "vast", "aws_spot")
        region_reported: the raw region string from the provider

    Returns:
        NormalizedRegion with whatever fields can be extracted.
    """
    if not region_reported:
        return NormalizedRegion()

    if source == "aws_spot":
        return _normalize_aws_region(region_reported)
    elif source == "azure":
        return _normalize_azure_region(region_reported)
    elif source == "gcp":
        return _normalize_gcp_region(region_reported)
    elif source == "vast":
        return _normalize_vast_region(region_reported)
    elif source == "tensordock":
        return _normalize_tensordock_region(region_reported)
    else:
        # RunPod doesn't provide region info per offer
        return NormalizedRegion()


def _normalize_aws_region(az: str) -> NormalizedRegion:
    """Normalize an AWS availability zone like 'us-east-1a' to region info."""
    # Strip the AZ suffix (a, b, c, etc.) to get the region
    region = az.rstrip("abcdefgh")
    info = AWS_REGION_MAP.get(region)
    if info:
        return NormalizedRegion(country=info[0], state=info[1])
    return NormalizedRegion()


def _normalize_azure_region(region: str) -> NormalizedRegion:
    """Normalize an Azure ARM region such as 'eastus' to region info."""
    info = AZURE_REGION_MAP.get(region)
    if info:
        return NormalizedRegion(country=info[0], state=info[1])
    logger.warning("Unknown Azure ARM region %r; returning empty region", region)
    return NormalizedRegion()


def _normalize_gcp_region(region_id: str) -> NormalizedRegion:
    """Normalize a GCP region id like 'us-central1' to region info."""
    info = GCP_REGION_MAP.get(region_id)
    if info:
        return NormalizedRegion(country=info[0], state=info[1])
    return NormalizedRegion()


def _normalize_vast_region(geolocation: str) -> NormalizedRegion:
    """Normalize a Vast.ai geolocation string like 'Virginia, US' or 'South Korea, KR'."""
    parts = [p.strip() for p in geolocation.split(",")]

    if len(parts) == 2:
        location_name, country_code = parts[0], parts[1]
        country, _ = _country_to_iso2(country_code)
        # The first part could be a state, city, or country name
        return NormalizedRegion(country=country, state=location_name)
    elif len(parts) == 1:
        # Just a country code
        country, _ = _country_to_iso2(parts[0])
        return NormalizedRegion(country=country)

    return NormalizedRegion()


def _normalize_tensordock_region(region_str: str) -> NormalizedRegion:
    """Normalize a TensorDock region like 'Las Vegas, Nevada, US' or 'Tallinn, Estonia'."""
    parts = [p.strip() for p in region_str.split(",")]

    if len(parts) == 3:
        city, state, country_in = parts
        country, _ = _country_to_iso2(country_in)
        return NormalizedRegion(country=country, state=state, city=city)
    elif len(parts) == 2:
        state, country_in = parts
        country, _ = _country_to_iso2(country_in)
        return NormalizedRegion(country=country, state=state)
    elif len(parts) == 1:
        country, _ = _country_to_iso2(parts[0])
        return NormalizedRegion(country=country)

    return NormalizedRegion()


@dataclass
class RegionNormalizationExplanation:
    """Attribution for region normalization (read-path only).

    Produced by `explain_normalize_region`. Never consumed by the write
    path; see ADR 0004.

    `branch` names the source-specific code path taken:
      "aws_spot"   — AWS availability-zone parsing
      "azure"      — Azure ARM-region lookup
      "gcp"        — GCP region-id parsing
      "vast"       — Vast.ai 'City, CC' or 'CC' geolocation parsing
      "tensordock" — TensorDock three-part region strings
      "empty"      — region_reported was None/empty
      "unsupported"— source has no region parser (e.g., runpod)

    `trail` is an ordered list of human-readable decision steps.
    """

    source: str
    region_reported: str | None
    branch: str
    country: str | None
    state: str | None
    city: str | None
    trail: list[str] = field(default_factory=list)


def explain_normalize_region(
    source: str, region_reported: str | None
) -> RegionNormalizationExplanation:
    """Return attribution for the normalize_region decision."""
    if not region_reported:
        return RegionNormalizationExplanation(
            source=source,
            region_reported=region_reported,
            branch="empty",
            country=None,
            state=None,
            city=None,
            trail=["region_reported is None/empty; no normalization applied"],
        )

    if source == "aws_spot":
        return _explain_aws_region(region_reported)
    if source == "azure":
        return _explain_azure_region(region_reported)
    if source == "gcp":
        return _explain_gcp_region(region_reported)
    if source == "vast":
        return _explain_vast_region(region_reported)
    if source == "tensordock":
        return _explain_tensordock_region(region_reported)

    return RegionNormalizationExplanation(
        source=source,
        region_reported=region_reported,
        branch="unsupported",
        country=None,
        state=None,
        city=None,
        trail=[f"source {source!r} has no region parser; returning empty region"],
    )


def _explain_aws_region(az: str) -> RegionNormalizationExplanation:
    trail = [f"input: AZ {az!r}"]
    region = az.rstrip("abcdefgh")
    trail.append(f"strip AZ suffix: {az!r} -> region key {region!r}")
    info = AWS_REGION_MAP.get(region)
    if info:
        trail.append(f"AWS_REGION_MAP[{region!r}] -> (country={info[0]!r}, state={info[1]!r})")
        return RegionNormalizationExplanation(
            source="aws_spot",
            region_reported=az,
            branch="aws_spot",
            country=info[0],
            state=info[1],
            city=None,
            trail=trail,
        )
    trail.append(f"AWS_REGION_MAP[{region!r}] -> no match; returning empty region")
    return RegionNormalizationExplanation(
        source="aws_spot",
        region_reported=az,
        branch="aws_spot",
        country=None,
        state=None,
        city=None,
        trail=trail,
    )


def _explain_azure_region(region: str) -> RegionNormalizationExplanation:
    trail = [f"input: Azure ARM region {region!r}"]
    info = AZURE_REGION_MAP.get(region)
    if info:
        trail.append(
            f"AZURE_REGION_MAP[{region!r}] -> "
            f"(country={info[0]!r}, state={info[1]!r})"
        )
        return RegionNormalizationExplanation(
            source="azure",
            region_reported=region,
            branch="azure",
            country=info[0],
            state=info[1],
            city=None,
            trail=trail,
        )
    trail.append(
        f"AZURE_REGION_MAP[{region!r}] -> no match; returning empty region"
    )
    return RegionNormalizationExplanation(
        source="azure",
        region_reported=region,
        branch="azure",
        country=None,
        state=None,
        city=None,
        trail=trail,
    )


def _explain_gcp_region(region_id: str) -> RegionNormalizationExplanation:
    trail = [f"input: region id {region_id!r}"]
    info = GCP_REGION_MAP.get(region_id)
    if info:
        trail.append(
            f"GCP_REGION_MAP[{region_id!r}] -> (country={info[0]!r}, state={info[1]!r})"
        )
        return RegionNormalizationExplanation(
            source="gcp",
            region_reported=region_id,
            branch="gcp",
            country=info[0],
            state=info[1],
            city=None,
            trail=trail,
        )
    trail.append(f"GCP_REGION_MAP[{region_id!r}] -> no match; returning empty region")
    return RegionNormalizationExplanation(
        source="gcp",
        region_reported=region_id,
        branch="gcp",
        country=None,
        state=None,
        city=None,
        trail=trail,
    )


def _explain_vast_region(geolocation: str) -> RegionNormalizationExplanation:
    trail = [f"input: geolocation {geolocation!r}"]
    parts = [p.strip() for p in geolocation.split(",")]
    trail.append(f"split on ',' -> {parts}")

    if len(parts) == 2:
        location_name, country_code = parts[0], parts[1]
        country, rule = _country_to_iso2(country_code)
        trail.append(
            f"_country_to_iso2({country_code!r}) -> country={country!r} (rule={rule!r}); "
            f"state={location_name!r} (first part)"
        )
        return RegionNormalizationExplanation(
            source="vast",
            region_reported=geolocation,
            branch="vast",
            country=country,
            state=location_name,
            city=None,
            trail=trail,
        )
    if len(parts) == 1:
        country, rule = _country_to_iso2(parts[0])
        trail.append(
            f"_country_to_iso2({parts[0]!r}) -> country={country!r} (rule={rule!r}); "
            "no state/city"
        )
        return RegionNormalizationExplanation(
            source="vast",
            region_reported=geolocation,
            branch="vast",
            country=country,
            state=None,
            city=None,
            trail=trail,
        )
    trail.append(f"unexpected part count ({len(parts)}); returning empty region")
    return RegionNormalizationExplanation(
        source="vast",
        region_reported=geolocation,
        branch="vast",
        country=None,
        state=None,
        city=None,
        trail=trail,
    )


def _explain_tensordock_region(region_str: str) -> RegionNormalizationExplanation:
    trail = [f"input: region {region_str!r}"]
    parts = [p.strip() for p in region_str.split(",")]
    trail.append(f"split on ',' -> {parts}")

    if len(parts) == 3:
        city, state, country_in = parts
        country, rule = _country_to_iso2(country_in)
        trail.append(
            f"_country_to_iso2({country_in!r}) -> country={country!r} (rule={rule!r}); "
            f"state={state!r}, city={city!r}"
        )
        return RegionNormalizationExplanation(
            source="tensordock",
            region_reported=region_str,
            branch="tensordock",
            country=country,
            state=state,
            city=city,
            trail=trail,
        )
    if len(parts) == 2:
        state, country_in = parts
        country, rule = _country_to_iso2(country_in)
        trail.append(
            f"_country_to_iso2({country_in!r}) -> country={country!r} (rule={rule!r}); "
            f"state={state!r}"
        )
        return RegionNormalizationExplanation(
            source="tensordock",
            region_reported=region_str,
            branch="tensordock",
            country=country,
            state=state,
            city=None,
            trail=trail,
        )
    if len(parts) == 1:
        country, rule = _country_to_iso2(parts[0])
        trail.append(
            f"_country_to_iso2({parts[0]!r}) -> country={country!r} (rule={rule!r})"
        )
        return RegionNormalizationExplanation(
            source="tensordock",
            region_reported=region_str,
            branch="tensordock",
            country=country,
            state=None,
            city=None,
            trail=trail,
        )
    trail.append(f"unexpected part count ({len(parts)}); returning empty region")
    return RegionNormalizationExplanation(
        source="tensordock",
        region_reported=region_str,
        branch="tensordock",
        country=None,
        state=None,
        city=None,
        trail=trail,
    )
