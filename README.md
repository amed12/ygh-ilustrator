# Yu-Gi-Oh! Dynamic TCG Combo State Engine

An interactive, static-first, and data-driven Yu-Gi-Oh combo visualizer and practice cockpit built to prevent user misplays under complex branching conditions (Success paths vs. Negated paths).

---

## 🚀 Key Features

* **Cockpit Interface**: A high-density dashboard built on dark-tech aesthetics (`DESIGN_VARIANCE: 6`, `VISUAL_DENSITY: 8`, `MOTION_INTENSITY: 5`) with Outfit and JetBrains Mono typography, custom scrollbars, and tactile active-glow node cards.
* **Smart Deck Parsing**: Supports drag-and-drop `.ydk` file upload and base64 little-endian `ydke://` URL format parsing. Automatically identifies Main, Extra, and Side Deck card registry lists.
* **Stateful Combo Engine**: A pure logic state machine (`comboEngine.ts`) with O(1) step map lookups to track active stages, log history parameters, and calculate outcome progress without React render overhead.
* **Opening Hand Solver**: Pick a specific opening hand (`HandSelector.tsx`) and the app surfaces which pre-defined/custom routes are actually playable with it (`findPlayableRoutes`), or hands the hand off to the AI solver — with hypergeometric draw-probability math (`engine/probability.ts`) to gauge how likely a hand is.
* **Manual Combo Creator**: Build and edit combo routes by hand from your own deck (`ComboCreator.tsx`) without needing an AI at all — useful for correcting or extending an AI/import result.
* **Multi-Provider AI Solver**: Generates dynamic step-by-step custom combo routes on-the-fly from *any* deck list. Supported providers include:
  - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.5-pro-latest`)
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`)
  - **Anthropic Claude** (`claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`)
  - **OpenRouter** (`deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`, `google/gemini-2.5-flash`)
  - **DeepSeek** (`deepseek-chat`, `deepseek-reasoner`)
* **Anti-Hallucination Pipeline**: Pre-generation validation restricts LLMs to using cards actually present in the deck. Post-generation parsing verifies output against the strict TypeScript schema, checks for infinite loops/cycles, and confirms valid step pointers before loading.
* **Dual-Key Settings Routing**: Users can toggle between **Demo Mode** (free, rate-limited serverless API proxy using server env vars) or **Custom Key Mode** (direct secure browser fetches to LLMs utilizing credentials saved only in LocalStorage).
* **Import/Export & Shareable Links**: Export a single combo or your whole accumulated "Playbook" as a `.json` file (`services/comboIO.ts`), re-import it later, or copy a self-contained shareable link (`services/shareLink.ts`) that bundles the combo — and optionally the deck — for a recipient to open and practice immediately.
* **Card Info Tooltips**: Hovering any card in the deck grid or combo view shows live oracle text, ATK/DEF, and archetype via `CardTooltip.tsx`, backed by data fetched from the YGOPRODeck API.
* **Session Persistence**: Deck, custom/AI-generated routes, and fetched card details are persisted to `localStorage` so a page refresh doesn't lose your session.
* **Automated CI/CD validation**: Bundled GitHub Actions workflow that installs dependencies, runs the linter, verifies strict type compilation (`tsc --noEmit`), and does a full production build (`npm run build`) on every push/PR to `main`.

---

## 🤖 Creating Combos with an External AI

Besides the built-in AI solver, you can ask any external AI chat (ChatGPT, Claude.ai,
Gemini, etc.) to write a combo for you and import the result as a `.json` file — including
importing many combos at once as a "Playbook". See **[docs/creating-combos-with-ai.md](docs/creating-combos-with-ai.md)**
for the exact file format, a ready-to-copy prompt template, and two verified working
examples.

---

## 🛠️ Technology Stack

* **Framework**: Next.js 16.2 (App Router), React 19.2
* **Styling**: Tailwind CSS v4, Vanilla CSS
* **Icons**: `@phosphor-icons/react`
* **Animations**: `motion` (Framer Motion)
* **Type Safety**: TypeScript (Strict)
* **Hosting**: Vercel-ready (Serverless + Static) / Cloudflare Pages compatible (Static HTML Export)

---

## 📁 Architecture & File Tree

The project strictly decouples presentation elements from logic and data registries:

```
yugioh-masterdeck/
├── .agents/
│   └── AGENTS.md              # AI agent rules & guardrails
├── .github/
│   └── workflows/
│       └── ci.yml             # Github Actions CI validation pipeline
├── CONVENTIONS.md             # Developer coding conventions
├── next.config.ts             # Next.js configurations (Static export setup)
├── src/
│   ├── types.ts               # Single source of truth for strict interfaces
│   ├── data/
│   │   ├── cards.ts           # Card registry containing verified passcodes & URLs
│   │   └── combos/
│   │       ├── index.ts       # Combo indexing registry
│   │       └── raidraptor.ts  # Pre-defined offline Raidraptor combos
│   ├── parser/
│   │   └── ydk.ts             # Pure YDK / YDKE file format decoder
│   ├── engine/
│   │   ├── comboEngine.ts     # Pure state machine engine (O(1) lookups)
│   │   └── probability.ts     # Hypergeometric draw-probability math for hand odds
│   ├── services/
│   │   ├── aiClient.ts        # Unified multi-provider API fetcher (also owns per-provider model lists)
│   │   ├── prompts.ts         # Structured LLM combo prompts
│   │   ├── validator.ts       # AI response JSON schema validator
│   │   ├── comboIO.ts         # Combo/Playbook .json export, import, and parsing
│   │   └── shareLink.ts       # Encodes/decodes shareable combo links
│   ├── components/
│   │   ├── SettingsModal.tsx  # API key, provider, and model configurations
│   │   ├── DeckImporter.tsx   # Landing drag-and-drop .ydk paste panel
│   │   ├── DeckGrid.tsx       # Main visual grid displaying cards
│   │   ├── ComboSelector.tsx  # Pre-defined and AI route options panel
│   │   ├── ComboGenerator.tsx # Skeleton loading animation overlay
│   │   ├── ComboNavigator.tsx # Active step practicing dashboard
│   │   ├── ComboCreator.tsx   # Manual (no-AI) combo route builder/editor
│   │   ├── ComboSolver.tsx    # Shows playable routes + triggers AI solve for a chosen hand
│   │   ├── HandSelector.tsx   # Opening hand / turn-position picker modal
│   │   ├── OpeningHandPanel.tsx # Read-only opening hand summary shown during practice
│   │   ├── CardDisplay.tsx    # Card image load handler and error fallback
│   │   ├── CardTooltip.tsx    # Hover tooltip with live card oracle text/stats
│   │   ├── FlowChart.tsx      # SVG-like flowchart mapping success/negated lines
│   │   └── StepTimeline.tsx   # Monospace history logs timeline
│   └── app/
│       ├── layout.tsx         # Page wrappers & fonts
│       ├── page.tsx           # Core page state controller
│       ├── globals.css        # Global CSS variables & scrollbars
│       └── api/
│           └── generate/
│               └── route.ts   # Demo serverless POST handler proxy
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js v20 or higher
* npm or yarn

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/yugioh-masterdeck.git
   cd yugioh-masterdeck
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables (Optional)**:
   For local testing of the **Demo Mode** proxy, create a `.env.local` file and add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. **Build and test production locally**:
   ```bash
   npm run build
   ```

---

## ⚡ Deployment Guides

### Option 1: Vercel (Recommended - Serverless + Static)

Vercel supports both static page hosting and backend edge routes natively out-of-the-box.

1. Connect your Github repository to the Vercel dashboard.
2. In Project Settings under **Environment Variables**, add:
   * Key: `GEMINI_API_KEY`
   * Value: `[Your Google Gemini API Key]`
3. Deploy the project. Vercel will automatically compile the client static pages and register the serverless proxy.

### Option 2: Cloudflare Pages (Pure Static Export)

This project has static HTML export pre-configured.

1. In your Cloudflare Pages project setup, connect the Github repository.
2. Configure the Build Settings:
   - **Framework Preset**: None (or Next.js-static if available)
   - **Build Command**: `npm run build`
   - **Build Output Directory**: **`out`** (Crucial: do not use `.next` or `public`)
3. Deploy the project.

> [!WARNING]
> **Static Deployments Constraint**: Pure static hostings (like Cloudflare Pages without Workers) cannot execute Node.js backend routes. Consequently, the **Demo Mode** (calling `/api/generate`) will return a 404 error. Users must switch to **Custom Key Mode** under the Settings panel to generate AI combos on static hosts.

---

## 🛡️ Development & Git Guidelines

To maintain clean repository standards, follow these guidelines:

* **No direct `git add .`**: Always group modified files logically by purpose and commit them selectively.
* **Conventional Commits**: Ensure all commits match the Conventional Commits v1.0.0 standards:
  - `feat`: user-facing new feature addition
  - `fix`: bug fixes
  - `docs`: documentation updates
  - `build` / `ci`: build configuration adjustments or GitHub workflows updates
  - `chore`: package/dependency updates or minor refactoring chores
* **Strict Verification**: Before committing or pushing code, always verify compiler status:
  - Run `npx tsc --noEmit` to ensure zero typescript compile warnings.
  - Run `npm run lint` to guarantee complete linter validation.
