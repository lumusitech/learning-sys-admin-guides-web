/**
 * Punto de entrada de las mejoras de cliente.
 *
 * Cada módulo es responsable de una sola interacción y exporta `initX()`.
 * Todo es progressive enhancement: sin JS el contenido sigue siendo legible.
 */

import { initCardsToolbar } from './modules/cards-toolbar';
import { initCodeCopy } from './modules/code-copy';
import { initDrawer } from './modules/drawer';
import { initMermaid } from './modules/mermaid';
import { initReadingProgress } from './modules/reading-progress';
import { initTheme } from './modules/theme';
import { initTocActive } from './modules/toc-active';
import { initTocMenu } from './modules/toc-menu';
import { initGlobalSearch, initLocalSearch } from './search';

initTheme();
initCodeCopy();
initReadingProgress();
initMermaid();
initCardsToolbar();
initDrawer();
initTocMenu();
initTocActive();
initGlobalSearch();
initLocalSearch();
