# learning-sys-admin-guides-web

Sitio de estudio para las guías de sysadmin/SRE de
[`learning-sys-admin-guides`](https://github.com/lumusitech/learning-sys-admin-guides).

**Estado:** PoC. El contenido markdown vive en `content/` como andamio temporal;
la versión final tendrá contenido propio.

## Stack

- Astro 7 + TypeScript strict
- Tailwind 4 (`@tailwindcss/vite`, tokens en `@theme`, sin `tailwind.config.js`)
- Shiki con dual theme (`github-light` / `github-dark-default`)
- Mobile-first: el celular es la superficie principal de estudio

## Desarrollo

```bash
pnpm install
pnpm dev         # http://localhost:4321
pnpm build       # genera dist/
pnpm check       # tipos
pnpm lint:icons  # coherencia de iconos en los títulos
pnpm lint:language  # español neutro (sin voseo ni regionalismos)
```

## Convenciones de contenido

- **Idioma:** español neutro, con "tú" imperativo. Reglas y tabla de conversión
  en [`docs/content-style.md`](docs/content-style.md); lo valida `pnpm lint:language`
  (corre en CI).
- **Iconos:** set canónico y reglas en [`docs/icon-system.md`](docs/icon-system.md).
  Lo valida `pnpm lint:icons` (corre en CI): todo título necesita un icono del set.
- **Guides nuevos:** partir de [`docs/guide-template.md`](docs/guide-template.md).
- CI en `.github/workflows/ci.yml`: `lint:icons` + `lint:language` + `check` + `build` en cada PR.

## Flujo de trabajo

- `main` protegida: solo PR con al menos una aprobación.
- Ramas `feat/*`, `fix/*`, `content/*`, `chore/*`.
- El markdown de `content/` se sincroniza con `scripts/prepare-content.mjs`.
