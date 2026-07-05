# Yu-Gi-Oh MasterDeck — Agent Rules

## Project Identity
- **Product**: Dynamic TCG Combo State Engine
- **Stack**: Next.js (App Router), TypeScript (Strict), Tailwind CSS v4
- **Deploy**: Vercel (Static export + Serverless API routes)

## Architecture Boundaries (DO NOT VIOLATE)
- `src/types.ts` → Single source of truth for ALL interfaces
- `src/parser/` → Pure functions. ZERO side effects. No React imports.
- `src/engine/` → Pure state machine. ZERO UI/React dependency.
- `src/services/` → AI client & prompt templates. No UI logic.
- `src/components/` → React UI ONLY. No direct API calls (use services/).
- `src/data/` → Static combo data (Data-as-Code). Used for offline/demo mode.

## STRICT RULES

### 1. NO CARD HALLUCINATION
- NEVER invent card names, IDs, or effects.
- Every card referenced MUST have a verified passcode from ygoprodeck.com.
- If unsure about a card ID, leave a `// TODO: VERIFY_ID` comment.
- Image URL format: `https://images.ygoprodeck.com/images/cards/{passcode}.jpg`

### 2. TYPE SAFETY
- All combo data MUST satisfy the `ComboRoute` interface from `types.ts`.
- All AI-generated JSON MUST be validated against the schema before use.
- `tsconfig.json` uses `"strict": true`. Do not weaken this.
- `any` type is BANNED. Use `unknown` + type guards if needed.

### 3. PURE LOGIC SEPARATION
- `comboEngine.ts` must work WITHOUT React. It's a pure state machine.
- `ydk.ts` parser must work WITHOUT browser APIs (no `document`, no `window`).
- Test: these modules must be importable in a plain Node.js script.

### 4. AI COMBO GENERATION
- All LLM prompts are defined in `src/services/prompts.ts`. 
- NEVER hardcode prompts inline in components.
- AI responses MUST be JSON-parsed AND validated before use.
- If validation fails, show user-friendly error. NEVER render invalid data.

### 5. SECURITY
- API keys from users are stored in LocalStorage ONLY. Never send to our server.
- Demo API key lives in Vercel env vars ONLY. Never commit to repo.
- `.env.local` is in `.gitignore`. Enforce this.

### 6. FILE NAMING
- Components: PascalCase (e.g., `DeckImporter.tsx`)
- Utilities/services: camelCase (e.g., `comboEngine.ts`)
- Data files: camelCase (e.g., `raidraptor.ts`)
- Types: PascalCase interfaces, camelCase variables

### 7. FORBIDDEN PATTERNS
- ❌ `console.log` in production code (use proper error boundaries)
- ❌ `// @ts-ignore` or `// @ts-expect-error` without justification
- ❌ `any` type
- ❌ Inline styles (use Tailwind classes)
- ❌ Direct fetch() to LLM APIs from components (use services/)

### 8. GIT COMMITS WORKFLOW
- Every time code is added, changed, or removed, you MUST run the git commit workflow following the `smart-conventional-commits` skill.
- Do NOT run `git add .` to stage all changes at once if they have different purposes. Group files logically, stage them separately, and commit using Conventional Commits v1.0.0.
- End your run by checking and committing all uncommitted changes.
