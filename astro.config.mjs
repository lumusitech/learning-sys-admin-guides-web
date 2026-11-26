import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { mdastCards } from './src/plugins/mdast-cards.mjs';
import { mdastMermaid } from './src/plugins/mdast-mermaid.mjs';
import { mdastRemoveH1 } from './src/plugins/mdast-remove-h1.mjs';

export default defineConfig({
  site: 'https://lumusitech.github.io',
  base: '/learning-sys-admin-guides-web',
  markdown: {
    // Sätteri es el procesador Markdown nativo y por defecto de Astro 7.
    // Los plugins se declaran como plugins mdast en vez de remark.
    processor: satteri({
      mdastPlugins: [mdastRemoveH1, mdastCards, mdastMermaid],
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