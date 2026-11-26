import { getCollection } from 'astro:content';

export interface NavEntry {
  id: string;
  title: string;
  section: string;
  level?: string;
  href: string;
}

export interface NavSubgroup {
  label: string;
  items: NavEntry[];
}

export interface NavGroup {
  section: string;
  label: string;
  items: NavEntry[];
  subgroups: NavSubgroup[];
}

export const SECTION_LABELS: Record<string, string> = {
  guides: 'Guías',
  scenarios: 'Escenarios',
  concepts: 'Conceptos',
  reference: 'Referencias',
  labs: 'Labs',
};

/** Etiqueta legible de una sección. */
export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

const SECTION_ORDER = ['guides', 'scenarios', 'concepts', 'reference', 'labs'];

const BASE = import.meta.env.BASE_URL;

/** Construye la ruta pública de una entrada del content collection. */
export function route(id: string): string {
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return `${base}${id}/`.replace(/\/{2,}/g, '/');
}

/** Agrupa las entradas por sección y subcarpeta, en orden pedagógico. */
export async function getNav(): Promise<NavGroup[]> {
  const entries = await getCollection('docs');

  const groups = new Map<string, NavGroup>();

  for (const entry of entries) {
    const parts = entry.id.split('/');
    const section = parts[0] ?? 'otros';
    const subgroup = parts.length > 2 ? parts[1] : undefined;

    let group = groups.get(section);
    if (!group) {
      group = {
        section,
        label: SECTION_LABELS[section] ?? section,
        items: [],
        subgroups: [],
      };
      groups.set(section, group);
    }

    const item: NavEntry = {
      id: entry.id,
      title: entry.data.title,
      section,
      level: entry.data.level,
      href: route(entry.id),
    };

    if (subgroup) {
      let bucket = group.subgroups.find((candidate) => candidate.label === subgroup);
      if (!bucket) {
        bucket = { label: subgroup, items: [] };
        group.subgroups.push(bucket);
      }
      bucket.items.push(item);
    } else {
      group.items.push(item);
    }
  }

  for (const group of groups.values()) {
    group.items.sort((a, b) => a.id.localeCompare(b.id));
    group.subgroups.sort((a, b) => a.label.localeCompare(b.label));
    for (const subgroup of group.subgroups) {
      subgroup.items.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  const ordered = SECTION_ORDER.filter((section) => groups.has(section));
  for (const section of groups.keys()) {
    if (!ordered.includes(section)) ordered.push(section);
  }

  return ordered.map((section) => groups.get(section)!);
}

/** Lista plana de todas las entradas, útil para el índice de búsqueda. */
export async function getAllEntries(): Promise<NavEntry[]> {
  const groups = await getNav();
  const flat: NavEntry[] = [];

  for (const group of groups) {
    flat.push(...group.items);
    for (const subgroup of group.subgroups) flat.push(...subgroup.items);
  }

  return flat;
}
