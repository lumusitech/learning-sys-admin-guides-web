import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { mdastCards } from './src/plugins/mdast-cards.mjs';
import { mdastCallout } from './src/plugins/mdast-callout.mjs';
import { mdastMermaid } from './src/plugins/mdast-mermaid.mjs';
import { mdastRemoveH1 } from './src/plugins/mdast-remove-h1.mjs';
import { mdastSim } from './src/plugins/mdast-sim.mjs';
import { hastTableWrap } from './src/plugins/hast-table-wrap.mjs';
import { hastCleanHeadingIds } from './src/plugins/hast-clean-heading-ids.mjs';
import { SITE_BASE } from './src/lib/site.mjs';

export default defineConfig({
  site: 'https://lumusitech.github.io',
  base: SITE_BASE,
  markdown: {
    // Sätteri es el procesador Markdown nativo y por defecto de Astro 7.
    // Los plugins se declaran como plugins mdast en vez de remark.
    processor: satteri({
      mdastPlugins: [mdastRemoveH1, mdastCards, mdastMermaid, mdastSim, mdastCallout],
      hastPlugins: [hastCleanHeadingIds, hastTableWrap],
      // Habilita las directivas `:::nombre{...}` usadas por `sim`.
      features: { directive: true },
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});