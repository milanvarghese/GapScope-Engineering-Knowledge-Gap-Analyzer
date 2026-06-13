# Deploying GapScope

Two pieces: the **frontend** (Vercel, serves `web/`) and the **sweep** (GitHub Actions,
refreshes `web/public/data.json`). Both are free.

## 1. Before anything: configure targets

Edit `config/targets.yaml` — set `you:` to your GitHub username and replace the placeholder
usernames under each role with real engineers you want to measure against. Edit
`config/baseline_seed.yaml` with tools/methods you already know. Until you do this, sweeps
analyze the placeholder accounts and produce meaningless data.

## 2. Frontend on Vercel

1. Go to vercel.com → **Add New → Project** → import
   `milanvarghese/GapScope-Engineering-Knowledge-Gap-Analyzer`.
2. Set **Root Directory** to `web`. Vercel auto-detects Next.js.
3. Deploy. Every push to `main` redeploys automatically.

The dashboard reads `web/public/data.json` (a sample is committed, so it renders immediately).

## 3. Automated sweeps on GitHub Actions

The workflow `.github/workflows/sweep.yml` runs the engine and commits a fresh
`web/public/data.json` (which triggers a Vercel redeploy).

- **Scheduled run** (Mondays 06:00 UTC): free, no LLM. Uses the built-in `GITHUB_TOKEN`.
- **Manual run**: Actions tab → "Gap sweep" → Run workflow → pick a role, optionally enable
  **enrich**.

To enable `--enrich` (methodologies + researched explanations + study recommendations), add a
repo secret:

- **Settings → Secrets and variables → Actions → New repository secret**
- Name: `ANTHROPIC_API_KEY`, Value: your Anthropic key.

Without that secret, leave enrich off — the free sweep still produces the ranked gap list.

## 4. Run a sweep locally (optional)

```powershell
$env:GITHUB_TOKEN = "github_pat_..."     # optional, raises rate limit
$env:ANTHROPIC_API_KEY = "sk-ant-..."    # only for --enrich
.\.venv\Scripts\gapscope.exe sweep --role ai-engineer --enrich --out web/public/data.json
```

Then `cd web; npm run dev` to preview at http://localhost:3000.
