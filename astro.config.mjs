import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { remarkCards } from './src/plugins/remark-cards.mjs';
import { remarkMermaid } from './src/plugins/remark-mermaid.mjs';
import { remarkRemoveH1 } from './src/plugins/remark-remove-h1.mjs';

export default defineConfig({
  site: 'https://lumusitech.github.io',
  base: '/learning-sys-admin-guides-web',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
    remarkPlugins: [remarkRemoveH1, remarkCards, remarkMermaid],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
