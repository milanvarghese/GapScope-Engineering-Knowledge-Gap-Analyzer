# GapScope — web

Next.js 15 frontend + API for goal-directed engineering gap analysis.

## Run locally

1. **Create `web/.env.local`** with your credentials:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   GITHUB_TOKEN=ghp_...
   ```

2. **Install dependencies** (from the `web/` directory):

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000).

5. **Use the app:**
   - Upload your résumé (PDF or text).
   - Enter your GitHub username.
   - Pick a goal (e.g. "Founding Engineer").
   - Click **Analyze** — the app harvests GitHub signal, calls Claude, and returns a concept map, learning path, project gaps, and positioning read.

## Tests

```bash
npx vitest run
```

## Build

```bash
npm run build
```
