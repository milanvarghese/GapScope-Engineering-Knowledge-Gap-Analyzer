import json
import re
import tomllib

_SPLIT = re.compile(r"[<>=!~;\[\s]")


def normalize_package_name(raw: str) -> str:
    """Lowercase a dependency token and strip version specifiers / extras / markers."""
    token = _SPLIT.split(raw.strip(), maxsplit=1)[0]
    return token.strip().lower()


def parse_requirements(text: str) -> set[str]:
    names: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        name = normalize_package_name(line)
        if name:
            names.add(name)
    return names


def parse_pyproject(text: str) -> set[str]:
    data = tomllib.loads(text)
    names: set[str] = set()
    project = data.get("project", {})
    for dep in project.get("dependencies", []):
        names.add(normalize_package_name(dep))
    for group in project.get("optional-dependencies", {}).values():
        for dep in group:
            names.add(normalize_package_name(dep))
    poetry = data.get("tool", {}).get("poetry", {}).get("dependencies", {})
    for key in poetry:
        if key.lower() != "python":
            names.add(normalize_package_name(key))
    names.discard("")
    return names


def parse_package_json(text: str) -> set[str]:
    data = json.loads(text)
    names: set[str] = set()
    for section in ("dependencies", "devDependencies"):
        for key in data.get(section, {}):
            names.add(normalize_package_name(key))
    names.discard("")
    return names


PARSERS = {
    "requirements.txt": parse_requirements,
    "pyproject.toml": parse_pyproject,
    "package.json": parse_package_json,
}
MANIFEST_NAMES = list(PARSERS.keys())


def parse_manifest(filename: str, text: str) -> set[str]:
    parser = PARSERS.get(filename)
    return parser(text) if parser else set()
