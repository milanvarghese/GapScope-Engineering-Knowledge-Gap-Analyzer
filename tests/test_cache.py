from gapscope.cache import DiskCache


def test_cache_round_trips_json(tmp_path):
    cache = DiskCache(str(tmp_path / "cache"))
    assert cache.get("k1") is None
    cache.set("k1", {"a": 1, "b": ["x"]})
    assert cache.get("k1") == {"a": 1, "b": ["x"]}


def test_cache_key_is_content_addressed(tmp_path):
    cache = DiskCache(str(tmp_path / "cache"))
    k_a = cache.key("haiku", "prompt one")
    k_b = cache.key("haiku", "prompt one")
    k_c = cache.key("haiku", "prompt two")
    assert k_a == k_b
    assert k_a != k_c


def test_cache_persists_across_instances(tmp_path):
    d = str(tmp_path / "cache")
    DiskCache(d).set("k2", {"v": 2})
    assert DiskCache(d).get("k2") == {"v": 2}
