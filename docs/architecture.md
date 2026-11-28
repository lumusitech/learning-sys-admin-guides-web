# Arquitectura

Mapa del sitio y de su cadena de contenido, para que una persona nueva pueda
añadir documentos sin reconstruir el contexto.

## Stack

- **Astro 7** con procesador Markdown nativo (Sätteri) y plugins mdast/hast.
- **Tailwind 4** vía `@tailwindcss/vite`, con tokens semánticos en `@theme`
  (`src/styles/global.css`). No hay `tailwind.config.js`.
- **TypeScript strict** (`tsconfig.json`) y contenido en la colección `docs`.
- **pnpm**; salida estática con base `/learning-sys-admin-guides-web`.

## Mapa de módulos

```
content/                 Markdown fuente (colección `docs`)
  guides/ scenarios/ concepts/ reference/ labs/

src/
  content.config.ts      Esquema del frontmatter (title, section, level, meta…)
  lib/
    base.ts              Base URL normalizada (siempre con barra final)
    nav.ts               Navegación desde la colección; `route()` arma rutas
    fuzzy.ts             Matcher difuso (contiguous > subsequence)
    search-index.mjs     Contrato compartido del índice (cliente + generador)
    dom.ts               Helpers tipados: query, queryAll, on
    inline-markdown.ts   Render inline seguro para valores de `meta`
    site.mjs             SITE_BASE compartido con tests y scripts
  scripts/
    enhance.ts           Entrada de cliente; llama a cada `initX()`
    modules/             Una responsabilidad por módulo (tema, copiar, TOC…)
    search/              Búsqueda global y local (entrada, vista, índice local)
  plugins/               Plugins mdast/hast (sim, cards, callout, mermaid…)
  components/            UI Astro (DocMeta, TocMenu, SearchBar…)
  layouts/               BaseLayout y DocLayout
  pages/                 índice y [...slug] (getStaticPaths desde la colección)

scripts/                 Lints y utilidades de contenido (Node, .mjs)
  lib/icon-set.mjs       Set canónico de iconos (fuente: docs/icon-system.md)
  lib/content-constants.mjs  Allowlists de secciones y niveles
  lib/upstream-ids.mjs   Listado de ids upstream y snapshot del allowlist
  pending-sync.json      Snapshot de ids que existen upstream (commiteado)
  lint-icons.mjs         Iconos en títulos y frontmatter
  lint-language.mjs      Español neutro (sin voseo)
  lint-content.mjs       Frontmatter, links internos y anclas
  lint-assets.mjs        Links a assets de labs que existen en public/labs
  new-guide.mjs          Scaffolder de documentos
  migrate-content.mjs    Migra iconos, idioma, índices, assets y callouts
  sync-allowlist.mjs     Regenera pending-sync.json desde el repo upstream
  sync-labs-assets.mjs   Copia los assets de labs del upstream a public/labs
  sync-content.mjs       Clona/usa upstream y sincroniza todo en un paso
  build-search-index.mjs Genera public/search-index.json
  prepare-content.mjs    Copia markdown upstream y refresca el allowlist
```

## Flujo de datos

1. **Contenido → navegación.** `getNav()` lee la colección `docs`, agrupa por
   sección y subcarpeta, y ordena por `id` (ruta del archivo). `route()` convierte
   el `id` en URL pública. No existe `order`: para orden pedagógico se usan
   prefijos numéricos en el nombre (`01-...`).
2. **Contenido → búsqueda.** `scripts/build-search-index.mjs` recorre
   `content/`, separa por encabezados y escribe `public/search-index.json`.
   `src/lib/search-index.mjs` define la forma (`SearchDocument`/`SearchBlock`),
   la valida en el cliente (`parseSearchIndex`) y la normaliza en el generador
   (`normalizeDocument`).
3. **Markdown → HTML.** `astro.config.mjs` registra plugins mdast:
   `mdastRemoveH1` (el H1 lo pinta el layout), `mdastCards` (`<!-- cards -->`),
   `mdastMermaid`, `mdastSim` (`:::sim`) y `mdastCallout` (`:::callout`).
   `hastCleanHeadingIds` y `hastTableWrap` ajustan el HTML final.
4. **Cliente.** `BaseLayout` importa `src/scripts/enhance.ts`, que inicializa
   los módulos de `scripts/modules/` y `scripts/search/`. Todo es progressive
   enhancement: sin JS el contenido sigue siendo legible.
5. **Índice de página.** Existe un único índice: el menú de la topbar
   (`TocMenu`), que reutiliza los `headings` de Astro y marca la sección activa.
   No hay índice lateral ni lista `## 📑 Índice` escrita a mano en el contenido.

## Cómo añadir un documento

```bash
pnpm new:guide guides mi-guia --title="Mi guía — qué resuelve" --level="Básico" --icon="⚡"
```

El scaffolder copia el esqueleto de [`guide-template.md`](./guide-template.md),
valida el icono contra el set canónico y se niega a sobrescribir.

Después:

1. Completa el frontmatter. `meta:` es una lista de filas
   `{ label, value?, links? }`; los enlaces internos van como `links[].id` y
   `DocMeta` los resuelve con `route()`.
2. Usa `:::callout{state=warning|tip|danger label="..."}` para advertencias.
3. Verifica en local: `pnpm verify`.

## Sync upstream

Un solo comando clona el upstream (o usa un checkout local), copia solo las
secciones publicables, reescribe los links a la base del sitio y refresca el
allowlist. Acepta `--section=<sección>` y `--skip-existing`; ignora README y
archivos que empiezan con `_`:

```bash
pnpm sync                              # clona el repo upstream en un temporal
pnpm sync --source=../ruta             # usa un checkout local
pnpm sync --section=guides --skip-existing
```

`pnpm content <sourceDir>` sigue disponible para una copia manual. El allowlist
también se regenera solo con `pnpm sync:allowlist <sourceDir>`.

`labs` es especial: upstream tiene un `README.md` que se publica como
`content/labs/laboratorio-docker.md` y 67 assets (docker-compose, scripts,
logs). Los assets se copian a `public/labs` con `pnpm sync:labs <sourceDir>`
(`pnpm sync` lo hace en un sync completo o de `labs`).

`public/labs` también aloja assets locales por módulo (`k8s`, `db`, …). El sync
solo copia/compara los archivos del upstream y **no borra** esos extras.

`pnpm lint:assets` valida que cada link a `${BASE}labs/...` resuelva a un
archivo de `public/labs`; `pnpm sync:labs --check --source=<dir>` compara
hashes con el upstream y detecta drift (también corre en el workflow semanal).

`scripts/pending-sync.json` es un snapshot determinista de los ids que existen
upstream (sin README ni archivos de raíz). Se commitea para que CI —sin acceso
al repo origen— distinga un link pendiente de un typo. El workflow
`Sync allowlist` corre semanalmente y falla si el snapshot quedó desactualizado.

> El contenido upstream ya está importado (159 documentos). La migración sigue
> disponible para reimportar o añadir secciones: `pnpm sync` copia, pero el
> contenido se revisa y adapta antes de commitear.

### Migración por sección

Tras importar una sección, `pnpm migrate:content --section=<sección>` aplica:

- icono a `h1`/`h2` y al `title:` del frontmatter (con reglas por palabra clave);
- español neutro según `docs/content-style.md`;
- eliminación del índice manual `## 📑 Índice` (el índice vive en la topbar);
- eliminación de back-links y enlaces a `README` de sección (el sitio tiene su navegación);
- `> ⚠️ ...` → `:::callout{state=warning}`.

Es una primera pasada determinista: revisa el diff y corre `pnpm verify`.

## Lints y verificación

| Comando | Qué valida |
|---|---|
| `pnpm lint:icons` | Título de página y `h2` con icono del set (h3+ opcional) |
| `pnpm lint:language` | Español neutro (sin voseo ni regionalismos) |
| `pnpm lint:content` | Frontmatter, links internos, anclas y allowlist de sync |
| `pnpm lint:assets` | Links a assets de labs que existen en `public/labs` |
| `pnpm check` | Tipos (Astro + TS strict) |
| `pnpm test` | Unitarios (Vitest) |
| `pnpm test:e2e` | E2E, accesibilidad (axe) y presupuestos de CSS/JS |
| `pnpm verify` | Toda la cadena anterior, en orden |

`lint:content` distingue **error** de **aviso**:

- **Error:** frontmatter incompleto o fuera de allowlist, link con base
  incorrecta, sin barra final, sección desconocida, ancla sin destino, o link a
  un id que no está en `content/` **ni** en `scripts/pending-sync.json`.
- **Aviso:** link a un id que está en el allowlist pero todavía no se copió; se
  asume pendiente de sync upstream y no rompe CI.

Las anclas se validan contra `dist/`, así que `lint:content` debe correr tras
`pnpm build` (CI y `pnpm verify` ya lo hacen en ese orden).

## CI

`.github/workflows/ci.yml` tiene dos jobs:

- **verify:** `lint:icons`, `lint:language`, `check`, `build`, `lint:content` y `lint:assets`.
- **test:** instala Chromium y corre `pnpm test:all` (unitarios + e2e, que
  incluyen axe y presupuestos).

`.github/workflows/sync-allowlist.yml` corre semanalmente: clona el upstream,
regenera el allowlist y falla si quedó desactualizado (drift).
