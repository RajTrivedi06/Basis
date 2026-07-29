import pytest

from basis.ml.features import extract_features


def test_extract_features_is_an_importable_scaffold() -> None:
    with pytest.raises(NotImplementedError, match=r"Stage 3\.2"):
        extract_features(sku="h100_sxm_80gb")
