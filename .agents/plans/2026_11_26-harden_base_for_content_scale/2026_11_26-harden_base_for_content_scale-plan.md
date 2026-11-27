---
name: 2026_11_26-harden_base_for_content_scale
description: Harden and standardize the Astro base (tests, component extraction, replicability) before scaling content
created_at: 2026-11-26T00:00:00Z
created_by:
  tool: opencode
  model:
    name: deepseek-v4.1-flash
    version: latest
    reasoning_effort: high
---

# Harden base for content scale

## Goal

Freeze an extremely tested, functional and replicable base for the site: a real test suite, extracted and DRY components, and content scaffolding plus integrity lints, so the remaining guides, concepts and scenarios can be added in bulk without regressions and with a code base a human can review.

## Context

Repo: `learning-sys-admin-guides-web` (Astro 7 + Tailwind 4, pnpm, static, base `/learning-sys-admin-guides-web`).

Key files:

- `astro.config.mjs`: Sätteri markdown processor + mdast/hast plugins from `src/plugins/`.
- `src/lib/nav.ts`: nav derived from the `docs` content collection; entries sorted by `id` (`localeCompare`); `route()` builds public paths from `src/lib/base.ts`.
- `src/scripts/enhance.ts` (314 lines): client monolith (theme, code copy, reading progress, mermaid, expand/collapse, drawer, TOC menu, TOC active).
- `src/scripts/search.ts` (481 lines): global search (dialog) + local search (dropdown) + index fetch/parse/render.
- `src/lib/fuzzy.ts` (170 lines): contiguous-then-subsequence matcher with highlight ranges.
- `src/styles/global.css` (824 lines): design tokens, layout, components, search and TOC styles.
- `scripts/`: `build-search-index.mjs`, `lint-icons.mjs`, `lint-language.mjs`, `prepare-content.mjs` (syncs markdown from the upstream repo and rewrites relative links to absolute site paths).
- `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile`, `lint:icons`, `lint:language`, `check`, `build`.
- `docs/content-style.md`, `docs/icon-system.md`, `docs/guide-template.md`, `README.md`.

Findings that justify this plan (measured on 2026-11-26):

- No automated tests at all: no Vitest, no Playwright suite, no `test` script. Verification so far was ad hoc through the Playwright MCP.
- Three client files hold almost all behavior: `enhance.ts` 287, `search.ts` 481, `global.css` 819 lines.
- The guide header block (`**Nivel:**`, `**Requisitos:**`, `**Ver escenarios relacionados:**`) is hand-written per guide (3 of 5 files) and repeats the absolute base URL in markdown.
- `docs/guide-template.md` declares `order: 10` in the frontmatter, but `getNav()` ignores `order` and sorts by `id`, so ordering currently depends on filename prefixes (`01-`, `15-`).
- 40 absolute internal links in `content/`, of which 37 point to ids that do not exist yet because they arrive from the upstream sync (`scripts/prepare-content.mjs`). There is no link integrity check that separates "pending sync" from "malformed link".
- Duplication risk grows with content: 3 of 5 guides repeat `Quick command`, the sim/cards conventions, and the reference section by hand.

Conventions that must hold (see `docs/content-style.md`, `docs/icon-system.md`):

- Neutral Spanish, "tú" imperative, enforced by `pnpm lint:language`.
- Every heading and page `title` starts with an icon from the canonical set, enforced by `pnpm lint:icons`.
- One commit/PR per work unit, always on an auxiliary branch (never `main`).

## Phases

### Phase 1: Verification harness (unit + e2e in CI) — COMPLETE (PR #17)

Objective: one command runs the whole test suite, and CI runs it on every PR. This is the feedback loop the rest of the plan depends on.

> Status: done. `tests/unit/fuzzy.test.ts`, `tests/e2e/base.spec.ts`, `vitest.config.ts`, `playwright.config.ts` and the `test` CI job are on `main`. PR #18 later added the code action bar and its overlap e2e, which Phase 2 must preserve.

Tasks:

1. Add dev dependencies: `vitest`, `@playwright/test`.
2. Add scripts: `test` (unit), `test:e2e` (Playwright against a preview build), `test:all` (both).
3. `tests/unit/fuzzy.test.ts`: contiguous match wins over a scattered one, whole word wins over a longer word containing it (`config` vs `configuration`), subsequence fallback still matches (`lsa` vs `ls -lth`), accent and case folding, returned ranges align with the original string, null on no match, empty query.
4. `tests/e2e/base.spec.ts` (built site via Playwright `webServer`):
   - home renders the section cards;
   - navigation from the sidebar reaches a guide;
   - the page TOC menu opens and marks the active section;
   - global search `config` returns a whole-word highlight;
   - local search `drq` finds a command line;
   - a `:::sim` block opens and shows its output;
   - the code copy button reports the copied state;
   - the theme toggle persists after reload;
   - a mermaid diagram renders an `svg`;
   - no horizontal overflow at 320 and 412 px on a doc page;
   - no console errors on the visited pages.
5. CI: add a `test` job that installs the browser (`npx playwright install --with-deps chromium`) and runs `test:all`.

Public contracts:

- npm scripts: `test`, `test:e2e`, `test:all`.
- Test paths: `tests/unit/fuzzy.test.ts`, `tests/e2e/base.spec.ts`.
- CI job name: `test`.

Exit criteria: `pnpm test` and `pnpm test:e2e` pass locally and in CI on a clean checkout.

Tasks to close the phase, in order:

1. Run `pnpm lint:icons`, `pnpm lint:language`, `pnpm check`, `pnpm test`, `pnpm test:e2e`.
2. STOP, present the changes for review, and suggest commit/PR messages (Spanish).

### Phase 2: Clean code and DRY components — IMPLEMENTED (PR #19)

Objective: split the client monoliths into single-purpose modules and stop hand-writing repeated guide headers, with zero behavior change.

Tasks:

1. Split `src/scripts/enhance.ts` into `src/scripts/modules/` files, each exporting `initX(): void`: `theme.ts`, `code-copy.ts`, `reading-progress.ts`, `mermaid.ts`, `drawer.ts`, `cards-toolbar.ts`, `toc-menu.ts`, `toc-active.ts`. `enhance.ts` becomes a thin entry that calls them in order.
2. Split `src/scripts/search.ts` into `src/scripts/search/index.ts` (entry), `global.ts` (dialog), `local.ts` (page dropdown).
3. Extract the search index shape into `src/lib/search-index.mjs` (`SearchDocument`, `SearchBlock`, `parseSearchIndex` for the client, `normalizeDocument` for the generator) and use it from both the client and `scripts/build-search-index.mjs`, so the generator and the consumer cannot drift. Use `.mjs` (not `.ts`) so the Node generator imports it without a loader, consistent with `src/lib/site.mjs`.
4. Add `src/lib/dom.ts` with typed helpers (`query`, `queryAll`, `on`) to remove repeated `querySelector` casts and null checks.
5. `src/components/DocMeta.astro` with props `{ level?: string; meta?: MetaRow[] }`, where `MetaRow = { label: string; value?: string; links?: Array<{ id: string; label?: string }> }`. Generic rows cover the heterogeneous headers in use today (Dominio, Herramientas, Archivos, Archivos de práctica, related links); paths resolve with `route()`, so no hardcoded base in markdown.
6. Move the hand-written header block out of `content/guides/diff.md`, `content/guides/dahua/dahua-discovery.md` and `content/scenarios/system/15-config-drift.md` into frontmatter (`level` plus a `meta` array of rows), add `meta` to the collection schema in `src/content.config.ts`, and update `docs/guide-template.md` to the frontmatter-first header.
7. `src/plugins/mdast-callout.mjs`: `:::callout{state=warning|tip|danger}` directive replacing the ad-hoc blockquote conventions, reusing the existing color tokens; register it in `astro.config.mjs` and reuse it in the guides that already carry warning blockquotes.
8. Keep every module under roughly 150 lines and give each a header comment stating its responsibility.

Public contracts:

- Module paths and exported init functions: `initTheme`, `initCodeCopy`, `initReadingProgress`, `initMermaid`, `initDrawer`, `initCardsToolbar`, `initTocMenu`, `initTocActive`, `initGlobalSearch`, `initLocalSearch`.
- Shared types: `SearchDocument`, `SearchBlock`, `parseSearchIndex`, `normalizeDocument`.
- Helper signatures in `src/lib/dom.ts`.
- `DocMeta` props: `level`, `meta[]` (with `MetaRow = { label, value?, links?[] }`).
- Frontmatter keys: `level` (string) plus `meta` (array of `{ label, value?, links? }` rows).
- Directive syntax: `:::callout{state=...}` with a label, plus its CSS classes.

Exit criteria: identical rendered behavior (Phase 1 e2e green), no module over 150 lines, and the header block gone from all guides.

Tasks to close the phase, in order:

1. Run `pnpm lint:icons`, `pnpm lint:language`, `pnpm check`, `pnpm test`, `pnpm test:e2e`.
2. STOP, present the changes for review, and suggest commit/PR messages (Spanish).

### Phase 3: Replicability, integrity and final hardening — IMPLEMENTED (this PR)

> Status: `order` eliminado del esquema y del template (el orden sigue el `id`). `new:guide` y `lint:content` están implementados; los links a ids que no están en `content/` ni en `scripts/pending-sync.json` son error (typo), y los que sí están en el allowlist son aviso (pendiente de sync). El allowlist se genera del listado upstream con `pnpm sync:allowlist <sourceDir>` y `prepare-content` lo refresca. El sync quedó automatizado con `pnpm sync` (clona el upstream) y un workflow semanal detecta drift del allowlist. `pnpm verify` encadena todo y CI corre `lint:content` tras el build. La accesibilidad (axe) y los presupuestos CSS/JS viven en `tests/e2e/quality.spec.ts`.

Objective: creating a new guide is one command, broken content fails CI, and the base is documented and accessible enough to freeze before content scales.

Tasks:

1. Resolve the ordering contract: either honor the frontmatter `order` in `getNav()` (numeric sort with `id` as tiebreaker) or drop `order` from the template. Document the chosen rule in `docs/guide-template.md` and `README.md`.
2. `scripts/new-guide.mjs` (`pnpm new:guide <section> <slug>` with `--title`, `--level`, `--icon`): scaffolds `content/<section>/<slug>.md` from `docs/guide-template.md`, validates the icon against the canonical set, refuses an existing id, and prints the next steps.
3. `scripts/lint-content.mjs` (`pnpm lint:content`):
   - frontmatter shape: required keys, `section` and `level` inside their allowlists;
   - internal link audit: malformed links (missing trailing slash, wrong base, non-existent section) fail; ids that only exist upstream (pending sync) are reported as warnings using an allowlist generated from the upstream listing;
   - anchors: every `href="#..."` has a matching `id` in the built HTML.
4. Accessibility: add `@axe-core/playwright` assertions for the home and a doc page (0 critical violations) and fix what they report.
5. Budgets: assert built CSS and JS size ceilings in the e2e suite, plus "no console errors" on every visited page; add `pnpm verify` that chains icons, language, content, check, unit and e2e.
6. `docs/architecture.md`: module map, data flow (content collection to nav and search index to client modules), how to add a guide (contributor path), and where the lints live; link it from `README.md`.
7. Cleanup pass: prune dead rules in `src/styles/global.css`, remove unused code, and make sure every module and component has a header comment stating its responsibility (no spaghetti).
8. Wire `lint:content` and the new jobs into `package.json` and `.github/workflows/ci.yml`.

Public contracts:

- `pnpm new:guide` CLI flags and generated frontmatter.
- `pnpm lint:content` output format and exit codes.
- `pnpm verify` aggregate script.
- Nav ordering rule (`order` then `id`) or its removal.
- Allowlist path for pending-sync ids.
- CSS/JS budget thresholds and `docs/architecture.md` sections.

Exit criteria: a new guide can be created and validated with one command chain, a malformed link fails CI while a pending-sync id only warns, and `pnpm verify` is green end to end (icons, language, content, types, unit, e2e, a11y) with the docs updated.

Tasks to close the phase, in order:

1. Run `pnpm verify` plus `pnpm build`.
2. STOP, present the changes for review, and suggest commit/PR messages (Spanish).

## Next step

Fase de contenido en curso: **`guides` importado y migrado (74 guías)**. Faltan `scenarios`, `concepts`, `reference` y `labs`. Para cada sección: `pnpm sync --section=<s> --skip-existing` + `pnpm migrate:content --section=<s>` + `pnpm verify`, revisando el diff (los iconos de `h2` salen de reglas heurísticas y pueden necesitar ajuste semántico).
