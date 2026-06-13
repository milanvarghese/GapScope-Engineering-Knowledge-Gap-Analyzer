from gapscope.manifests import (
    normalize_package_name,
    parse_requirements,
    parse_pyproject,
    parse_package_json,
    parse_manifest,
    MANIFEST_NAMES,
)


def test_normalize_strips_version_extras_case():
    assert normalize_package_name("FastAPI==0.110.0") == "fastapi"
    assert normalize_package_name("uvicorn[standard]>=0.27") == "uvicorn"
    assert normalize_package_name("torch ; python_version >= '3.9'") == "torch"
    assert normalize_package_name("@anthropic-ai/sdk") == "@anthropic-ai/sdk"


def test_parse_requirements_ignores_noise():
    text = (
        "# comment\n"
        "FastAPI==0.110.0\n"
        "uvicorn[standard]>=0.27\n"
        "langchain\n"
        "-r other.txt\n"
        "--index-url https://example\n"
        "torch ; python_version >= '3.9'\n"
        "\n"
    )
    assert parse_requirements(text) == {"fastapi", "uvicorn", "langchain", "torch"}


def test_parse_pyproject_pep621_and_optional():
    text = (
        '[project]\n'
        'name = "x"\n'
        'dependencies = ["fastapi>=0.110", "httpx", "pydantic>=2"]\n'
        '[project.optional-dependencies]\n'
        'dev = ["pytest"]\n'
    )
    assert parse_pyproject(text) == {"fastapi", "httpx", "pydantic", "pytest"}


def test_parse_pyproject_poetry_skips_python():
    text = (
        '[tool.poetry.dependencies]\n'
        'python = "^3.11"\n'
        'requests = "^2.31"\n'
    )
    assert parse_pyproject(text) == {"requests"}


def test_parse_package_json_deps_and_dev():
    text = '{"dependencies": {"react": "^18", "next": "14.0.0"}, "devDependencies": {"typescript": "^5"}}'
    assert parse_package_json(text) == {"react", "next", "typescript"}


def test_parse_manifest_dispatch():
    assert parse_manifest("requirements.txt", "flask\n") == {"flask"}
    assert parse_manifest("unknown.txt", "flask\n") == set()
    assert "package.json" in MANIFEST_NAMES
