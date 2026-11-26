# learning-sys-admin-guides-web

Sitio de estudio para las guías de sysadmin/SRE de
[`learning-sys-admin-guides`](https://github.com/lumusitech/learning-sys-admin-guides).

**Estado:** PoC. El contenido markdown vive en `content/` como andamio temporal;
la versión final tendrá contenido propio.

## Stack

- Astro 5 + TypeScript strict
- Tailwind 4 (`@tailwindcss/vite`, tokens en `@theme`, sin `tailwind.config.js`)
- Shiki con dual theme (`github-light` / `github-dark-default`)
- Mobile-first: el celular es la superficie principal de estudio

## Desarrollo

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # genera dist/
```

## Flujo de trabajo

- `main` protegida: solo PR con al menos una aprobación.
- Ramas `feat/*`, `fix/*`, `chore/*`.
- El markdown de `content/` se sincroniza con `scripts/prepare-content.mjs`.
