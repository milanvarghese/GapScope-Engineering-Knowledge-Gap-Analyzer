// Editable default engineer sets per role. EMPTY by default — users add targets via the UI's
// custom-handles input. Populate these later (e.g. once repo visibility is decided).
export const DEFAULT_PEOPLE: Record<string, string[]> = {
  "ai-engineer": [],
  "devops": [],
  "security": [],
};

// Curated tool -> official docs URL (deterministic, always correct for common tools).
export const DOCS_REGISTRY: Record<string, string> = {
  fastapi: "https://fastapi.tiangolo.com",
  langchain: "https://python.langchain.com",
  docker: "https://docs.docker.com",
  pytest: "https://docs.pytest.org",
  ruff: "https://docs.astral.sh/ruff/",
  pydantic: "https://docs.pydantic.dev",
};

// Bounding to fit Vercel Hobby's 60s function cap (see spec §4).
export const BOUNDS = { MAX_PEOPLE: 6, MAX_REPOS_PER_PERSON: 5, MAX_READMES: 8, CONCURRENCY: 5 };
