from gapscope.denoise import load_denoise_rules, apply_denoise


RULES = {
    "denylist_exact": {"postcss", "autoprefixer", "eslint"},
    "denylist_prefix": ("@types/",),
    "groups": {"@radix-ui/react-dialog": "shadcn/ui", "clsx": "shadcn/ui", "@radix-ui/react-tabs": "shadcn/ui"},
}


def test_denylist_drops_exact_and_prefix():
    tools = {"react", "postcss", "@types/node", "fastapi"}
    assert apply_denoise(tools, RULES) == {"react", "fastapi"}


def test_grouping_folds_family_to_one_concept():
    tools = {"@radix-ui/react-dialog", "@radix-ui/react-tabs", "clsx", "react"}
    out = apply_denoise(tools, RULES)
    assert out == {"shadcn/ui", "react"}   # three members collapse to one group


def test_load_rules_from_yaml(tmp_path):
    deny = tmp_path / "deny.yaml"
    deny.write_text("exact:\n  - eslint\nprefix:\n  - '@types/'\n", encoding="utf-8")
    groups = tmp_path / "groups.yaml"
    groups.write_text("shadcn/ui:\n  - clsx\n  - vaul\n", encoding="utf-8")
    rules = load_denoise_rules(str(deny), str(groups))
    assert "eslint" in rules["denylist_exact"]
    assert rules["denylist_prefix"] == ("@types/",)
    assert rules["groups"]["clsx"] == "shadcn/ui"
    assert rules["groups"]["vaul"] == "shadcn/ui"
