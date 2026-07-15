# Development Conventions

## Adding a New Combo Route (Data-as-Code)
1. Create `src/data/combos/{archetype}.ts`
2. Export an array of `ComboRoute` objects
3. Import and register in `src/data/combos/index.ts`
4. Every `cardId` in steps MUST exist in `src/data/cards.ts`
5. Run `npx tsc --noEmit` — build MUST pass

## Adding a New AI Provider
1. Add provider key to `AIProvider` union in `types.ts`
2. Add its model list to the `PROVIDER_MODELS` map and its fetch handler in `src/services/aiClient.ts`
3. Update `SettingsModal.tsx` dropdown

## Combo Step Rules
- `id` must be unique within a route (1-indexed)
- `next_success: null` means COMBO COMPLETE
- `next_negated: null` means NO RECOVERY (pass turn)
- Every `next_success` and `next_negated` value must 
  point to an existing step `id` in the same route
- Fallback steps (negated targets) should be placed 
  AFTER the main combo line (e.g., steps 10+)

## Git Workflow
- Branch naming: `feat/`, `fix/`, `docs/`
- Commits: Conventional Commits (e.g., `feat: add branded combo data`)
- PR required for `main` branch. CI must pass.
