/**
 * Sección activa del índice de la página.
 *
 * Observa los encabezados enlazados y marca el que entra en la banda visible
 * (IntersectionObserver con `rootMargin`), tanto en el TOC lateral como en el
 * menú de la topbar.
 */

export function initTocActive(): void {
  const tocLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('[data-toc] a[href^="#"]'),
  );
  if (tocLinks.length === 0) return;

  const byId = new Map<string, HTMLAnchorElement[]>();
  for (const link of tocLinks) {
    const id = decodeURIComponent(link.hash.slice(1));
    if (!id) continue;
    const links = byId.get(id);
    if (links) links.push(link);
    else byId.set(id, [link]);
  }

  const headings = Array.from(byId.keys())
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);

  const setActive = (id: string): void => {
    for (const [key, links] of byId) {
      for (const link of links) {
        link.dataset.active = key === id ? 'true' : 'false';
      }
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const first = visible[0];
      if (first) setActive(first.target.id);
    },
    { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
  );

  for (const heading of headings) observer.observe(heading);
}
