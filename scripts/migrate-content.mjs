#!/usr/bin/env node
/**
 * Migra contenido importado a las convenciones del sitio.
 *
 * - Icono obligatorio en `h1`, `h2` y en el `title:` del frontmatter.
 * - Español neutro: aplica la tabla de `docs/content-style.md`.
 * - Blockquotes `> ⚠️ ...` → `:::callout{state=warning}`.
 *
 * Uso: node scripts/migrate-content.mjs [--section=guides] [--dry-run]
 *
 * Es una herramienta de migración: después se corre `pnpm verify` y se revisan
 * los avisos (iconos de fallback, voseo restante, links).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SECTIONS } from './lib/content-constants.mjs';
import { iconKey, leadingEmoji, loadIconSet } from './lib/icon-set.mjs';

const argv = process.argv.slice(2);
const sectionArg = argv.find((arg) => arg.startsWith('--section='))?.slice('--section='.length) ?? null;
const dryRun = argv.includes('--dry-run');

if (sectionArg && !SECTIONS.includes(sectionArg)) {
  console.error(`Sección desconocida: ${sectionArg}`);
  process.exit(1);
}

const set = loadIconSet();

/* ------------------------------------------------------------------ */
/* Iconos                                                              */
/* ------------------------------------------------------------------ */

/** Reglas ordenadas: la primera que coincide gana. */
const ICON_RULES = [
  [/\bdiff\b/i, '🔀'],
  [/\b(ssh|scp|sftp|ssl|tls|certbot|certificado|permisos?|suid|sudo|usuarios?|grupos?|firewall|iptables|nftables|ufw)\b/i, '🔐'],
  [/\b(nginx|apache|httpd|web|https?|dns|dhcp|vlan|red|network|curl|wget|dig|nslookup)\b/i, '🌐'],
  [/\b(ping|traceroute|tcpdump|nmap|scan|wifi|wireless|access points?|cable|señal|telemetría)\b/i, '📡'],
  [/\b(df|du|lsblk|mount|lvm|raid|fdisk|parted|swap|disco|disk|almacenamiento|filesystem|inodos?|inode)\b/i, '💽'],
  [/\b(free|top|htop|ps|kill|nice|procesos?|systemd|systemctl|servicios?|kernel|boot)\b/i, '⚙️'],
  [/\b(apt|apk|dnf|yum|pacman|snap|paquetes?|dependencias?|repositorios?|repo|docker|podman|contenedores?|container)\b/i, '📦'],
  [/\b(git|ramas?|branch)\b/i, '🌿'],
  [/\b(cron|timer|programación|schedule)\b/i, '🕓'],
  [/\b(journal|journalctl|logs?|syslog|dmesg)\b/i, '📜'],
  [/\b(tar|rsync|backup|respaldo|restore|restaurar|gzip|zip)\b/i, '💾'],
  [/\b(busybox|alpine)\b/i, '🐧'],
  [/\b(dahua|cámaras?|camera|vigilancia)\b/i, '👀'],
  [/\b(awk|sed|grep|cut|sort|uniq|find|xargs|tr|wc|head|tail|regex|expresiones? regulares?)\b/i, '🔍'],
  [/\b(hardware|cpu|ram|memoria|motherboard|bios|uefi)\b/i, '🖥️'],
  [/\b(archivos?|files?)\b/i, '📁'],
  [/\b(directorios?|tree|árbol)\b/i, '📂'],

  // Casos específicos frecuentes (antes de las categorías genéricas)
  [/\btroubleshoot(?:ing)?\b/i, '🔍'],
  [/\binodes?\b/i, '💽'],
  [/\bqué son\b|\bque son\b/i, '🧠'],
  [/\binformación (?:del sistema|general)\b/i, '🖥️'],
  [/\bgestión de versiones\b/i, '🔄'],
  [/\bestructuras? de control\b/i, '🔄'],
  [/\bautenticación\b/i, '🔐'],
  [/\bcookies?\b|\bsesiones?\b/i, '📝'],
  [/\btiempos? de espera\b|\breintentos?\b/i, '🕓'],
  [/\bredireccion(?:es)?\b/i, '🔄'],
  [/\bárbol de decisión\b/i, '🗺️'],
  [/\bconsultas?\b/i, '🔎'],
  [/\boptimización\b|\brendimiento\b/i, '📊'],
  [/\bcontexto\b/i, '🔍'],
  [/\bimplementaciones?\b|\bnotas\b/i, '📝'],
  [/\bdispositivos?\b/i, '💽'],
  [/\bip (?:addr|route|neigh)\b|\bss\b|\bsockets?\b/i, '🌐'],
  [/\btablas? y cadenas\b|\bpolíticas?\b|\btargets?\b|\bmódulos? de coincidencia\b|\breglas?\b|\bpersistencia\b/i, '🔐'],
  [/\bsubnetting\b|\brouter\b|\bvlans?\b|\bnat\b|\bforwarding\b|\bbridge\b|\bvirtualización\b/i, '🌐'],
  [/\bvirtual hosts?\b|\bproxy\b|\brate limiting\b|\bload balancing\b|\bcaché\b/i, '🌐'],
  [/\bescaneo\b|\bfingerprinting\b|\bevasión\b/i, '🔎'],
  [/\bwrapper\b|\baur\b/i, '📦'],
  [/\bselección por\b|\bcomplemento\b/i, '🎛️'],
  [/\bsumarizar\b|\bexclusión\b/i, '📊'],
  [/\bacciones sobre resultados\b/i, '⚙️'],
  [/\bejemplos? profesionales\b/i, '🎯'],
  [/\bbegin\b|\bend\b|\bgetline\b/i, '📝'],
  [/\blongitud máxima\b/i, '📊'],
  [/\btipos? de patrón\b/i, '🎛️'],

  // Prefijos tolerantes a acentos (los `\b` fallan tras vocal acentuada)
  [/\bmtr\b/i, '📡'],
  [/logrotate/i, '📜'],
  [/\bntp\b|time sync/i, '🕓'],
  [/fail2ban/i, '🔐'],
  [/ulimits?|l[ií]mites de recursos/i, '📊'],
  [/sustituci[oó]n|direcciones y rangos|eliminaci[oó]n|inserci[oó]n|a[ñn]adido|cambio de l[ií]nea|transformaci[oó]n|edici[oó]n in-place|bucles y etiquetas/i, '🎛️'],
  [/orden (num[eé]rico|inverso|humano)|may[uú]sculas|estabilidad y merge|unique|aleatorizar/i, '🎛️'],
  [/cach[eé]/i, '📊'],
  [/[aá]rbol de decisi[oó]n/i, '🗺️'],
  [/interpretaci[oó]n/i, '📊'],
  [/presupuesto de potencia|c[aá]lculo de presupuesto/i, '📊'],
  [/qu[eé] se puede testear/i, '✅'],
  [/qu[eé] no funciona|no funciona en el contenedor/i, '🚫'],
  [/conexi[oó]n/i, '🔌'],
  [/wsl2|proxyjump|bastion/i, '🔐'],
  [/automatizaci[oó]n/i, '🔄'],
  [/samba|cifs|3-2-1|rotaci[oó]n|r[eé]plicas?|restauraci[oó]n/i, '💾'],
  [/slices?|units?|unidades/i, '⚙️'],
  [/filtro|bpf|an[aá]lisis avanzado/i, '🔎'],
  [/windows?|panes|pantalla/i, '🖥️'],
  [/contar|duplicados|[uú]nicos|ignorar|stdin/i, '🎛️'],
  [/paralelizar|reemplazar|manejar espacios|c[oó]mo funciona|lectura y escritura/i, '🎛️'],
  [/confirmar antes|modo verbose/i, '🎛️'],

  // Categorías de sección (h2)
  [/\b(quick|comando rápido|comandos? rápidos?)\b/i, '⚡'],
  [/\b(qué es|que es|conceptos?|modelo mental|introducción)\b/i, '🧠'],
  [/\b(salida|output|resultado)\b/i, '🔑'],
  [/\b(sintaxis|syntax|formato|estructura)\b/i, '📝'],
  [/\b(opciones?|flags?|parámetros?|argumentos?)\b/i, '🎛️'],
  [/\b(troubleshoot|diagnóstico|depuración|debug|solución de problemas)\b/i, '🔍'],
  [/\b(solución|solucion)\b/i, '🧯'],
  [/\b(errores?|fallos?|fallas?|problemas?|causas?)\b/i, '⚠️'],
  [/\b(uno-liners?|consejos?|tips?)\b/i, '💡'],
  [/\b(buenas prácticas|verificación|verificar|checklist|integridad|checksums?)\b/i, '✅'],
  [/\b(referencias?|ver también|enlaces?)\b/i, '🔗'],
  [/\b(síntomas?)\b/i, '🩺'],
  [/\b(flujo|diagrama|mapa|arquitectura)\b/i, '🗺️'],
  [/\b(escenarios?|casos? de uso|caso)\b/i, '🧩'],
  [/\b(comparación|comparativa|diferencias?|vs\b)\b/i, '⚖️'],
  [/\b(datos|métricas|estado|status|monitoreo|monitorización)\b/i, '📊'],
  [/\b(instalación|instalar|install)\b/i, '📦'],
  [/\b(configuración|configurar|config)\b/i, '⚙️'],
  [/\b(actualizar|actualización|update|upgrade|eliminar|remove|uninstall)\b/i, '🔄'],
  [/\b(seguridad|security)\b/i, '🔐'],
  [/\b(bases? de datos|database|sql|caché|cache)\b/i, '💽'],
  [/\b(patrones?|métodos?|método)\b/i, '📋'],
  [/\b(resumen|summary|mensajes? clave)\b/i, '📌'],
  [/\b(historial|qué cambió|cambios recientes)\b/i, '🕓'],
  [/\b(lecciones)\b/i, '🎓'],
  [/\b(caso de estudio)\b/i, '📖'],
  [/\b(preguntas?|dudas?)\b/i, '🤔'],
  [/\b(reducción|buscar|búsqueda|search)\b/i, '🔎'],
  [/\b(observar|observación)\b/i, '👀'],
  [/\b(objetivo|problema|por qué)\b/i, '🎯'],
  [/\b(mitigación|contención)\b/i, '🧯'],
  [/\b(procedimiento|runbook|herramientas?|comandos?)\b/i, '🛠️'],
  [/\b(ventajas?|beneficios?)\b/i, '✅'],
  [/\b(alternativa)\b/i, '🔄'],
  [/\b(fabricantes?|mac|oui)\b/i, '📡'],
  [/\b(modelos?)\b/i, '🧠'],
  [/\b(acceso|interfaz)\b/i, '🔌'],
  [/\b(puertos?|conectividad)\b/i, '🔌'],
  [/\b(variables?|funciones?|arrays?|operadores?|cabeceras?|campos?)\b/i, '📝'],
  [/\b(binarios?|hash|inspección)\b/i, '🔬'],
];

function iconFor(text, depth) {
  for (const [pattern, icon] of ICON_RULES) {
    if (pattern.test(text)) return icon;
  }
  return depth === 1 ? '🛠️' : '📋';
}

/* ------------------------------------------------------------------ */
/* Idioma                                                              */
/* ------------------------------------------------------------------ */

const REPLACEMENTS = [
  ['querés', 'quieres'], ['podés', 'puedes'], ['sabés', 'sabes'], ['tenés', 'tienes'],
  ['sos', 'eres'], ['entendés', 'entiendes'], ['comparás', 'comparas'], ['enfrentás', 'enfrentas'],
  ['descartás', 'descartas'], ['observás', 'observas'], ['resolvés', 'resuelves'], ['abrís', 'abres'],
  ['necesitás', 'necesitas'], ['usás', 'usas'], ['probás', 'pruebas'], ['pasás', 'pasas'],
  ['mirás', 'miras'], ['ejecutás', 'ejecutas'], ['dejás', 'dejas'], ['tirá', 'tira'],
  ['meté', 'mete'], ['ejecutá', 'ejecuta'], ['usá', 'usa'], ['guardá', 'guarda'],
  ['verificá', 'verifica'], ['normalizá', 'normaliza'], ['copiá', 'copia'], ['pensá', 'piensa'],
  ['tocá', 'toca'], ['agregá', 'agrega'], ['quitá', 'quita'], ['mirá', 'mira'], ['contá', 'cuenta'],
  ['nombrá', 'nombra'], ['tratá', 'trata'], ['documentá', 'documenta'], ['buscá', 'busca'],
  ['evitá', 'evita'], ['filtrá', 'filtra'], ['escribí', 'escribe'], ['resolvé', 'resuelve'],
  ['reducí', 'reduce'], ['pedí', 'pide'], ['capturá', 'captura'], ['aceptá', 'acepta'],
  ['elevá', 'eleva'], ['fijate', 'fíjate'], ['acordate', 'acuérdate'], ['olvidate', 'olvídate'],
  ['quedate', 'quédate'], ['decime', 'dime'], ['contame', 'cuéntame'], ['dale', 'continúa'],
  ['vos', 'tú'], ['acá', 'aquí'], ['laburo', 'trabajo'], ['guita', 'dinero'],
];

function replaceWord(text, from, to) {
  return text.replace(new RegExp(`\\b${from}\\b`, 'gi'), (match) => {
    if (match.length > 1 && match === match.toUpperCase()) return to.toUpperCase();
    if (match[0] === match[0].toUpperCase()) return to[0].toUpperCase() + to.slice(1);
    return to;
  });
}

function neutralSpanish(lines, stats) {
  let fence = false;
  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      return line;
    }
    if (fence) return line;

    let next = line;
    for (const [from, to] of REPLACEMENTS) {
      const before = next;
      next = replaceWord(next, from, to);
      if (next !== before) stats.language += 1;
    }
    return next;
  });
}

/* ------------------------------------------------------------------ */
/* Índice manual                                                       */
/* ------------------------------------------------------------------ */

/** Elimina las secciones `## 📑 Índice`: el índice vive en la topbar. */
function removeIndexSections(lines, stats) {
  const out = [];
  let index = 0;

  while (index < lines.length) {
    if (!/^##\s+.*(?:índice|indice)\s*$/i.test(lines[index])) {
      out.push(lines[index]);
      index += 1;
      continue;
    }

    // Salta el título y su lista hasta el próximo h2.
    index += 1;
    while (index < lines.length && !/^##\s/.test(lines[index])) index += 1;

    while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
    out.push('', '---', '');
    stats.indexes += 1;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Callouts                                                            */
/* ------------------------------------------------------------------ */

function convertCallouts(lines, stats) {
  const out = [];
  let index = 0;
  let fence = false;

  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      out.push(line);
      fence = !fence;
      index += 1;
      continue;
    }
    if (fence || !/^>\s?/.test(line)) {
      out.push(line);
      index += 1;
      continue;
    }

    const block = [];
    let cursor = index;
    while (cursor < lines.length && /^>\s?/.test(lines[cursor])) {
      block.push(lines[cursor].replace(/^>\s?/, ''));
      cursor += 1;
    }

    if (!/⚠️/.test(block[0] ?? '')) {
      out.push(...lines.slice(index, cursor));
      index = cursor;
      continue;
    }

    block[0] = block[0].replace(/⚠️\s*/, '');
    while (block.length > 0 && block[0].trim() === '') block.shift();
    out.push(':::callout{state=warning label="Atención"}', ...block, ':::');
    stats.callouts += 1;
    index = cursor;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Archivos                                                            */
/* ------------------------------------------------------------------ */

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { front: '', body: raw };
  return { front: match[1], body: raw.slice(match[0].length).replace(/^\n+/, '') };
}

const stats = { files: 0, h1: 0, h2: 0, badIcon: 0, language: 0, callouts: 0, indexes: 0, fallback: [] };

const files = sectionArg
  ? [...markdownFiles(join('content', sectionArg))]
  : [...markdownFiles('content')];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const { front, body } = splitFrontmatter(raw);
  if (!front) continue;

  const lines = body.split(/\r?\n/);

  // Icono de página: parte del h1 (o del title) y se replica en ambos.
  const titleMatch = front.match(/^title:\s*"([^"]*)"\s*$/m);
  const titleValue = titleMatch?.[1] ?? '';
  const titleEmoji = leadingEmoji(titleValue);
  const titleValid = titleEmoji && set.has(iconKey(titleEmoji));

  let h1Index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^#\s+/.test(lines[i])) { h1Index = i; break; }
  }

  let pageIcon = titleValid ? titleEmoji : null;
  if (h1Index !== -1) {
    const h1Match = lines[h1Index].match(/^#\s+(.*)$/);
    const h1Text = h1Match?.[1] ?? '';
    const h1Emoji = leadingEmoji(h1Text);
    if (h1Emoji && set.has(iconKey(h1Emoji))) pageIcon = h1Emoji;
    else pageIcon = pageIcon ?? iconFor(h1Text, 1);

    const clean = h1Emoji ? h1Text.slice(h1Emoji.length).trimStart() : h1Text;
    lines[h1Index] = `# ${pageIcon} ${clean}`;
  }

  if (!pageIcon) continue;
  const newTitle = titleEmoji
    ? `${pageIcon} ${titleValue.slice(titleEmoji.length).trimStart()}`
    : `${pageIcon} ${titleValue.trimStart()}`;

  let newFront = front;
  if (titleMatch) {
    newFront = front.replace(/^title:\s*"[^"]*"\s*$/m, `title: ${JSON.stringify(newTitle)}`);
    const oldEmoji = titleEmoji;
    if (oldEmoji && !set.has(iconKey(oldEmoji))) stats.badIcon += 1;
  }

  // h2: icono obligatorio (fuera de bloques de código).
  let fence = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*```/.test(lines[i])) {
      fence = !fence;
      continue;
    }
    if (fence) continue;

    const match = lines[i].match(/^##\s+(.*)$/);
    if (!match) continue;
    const text = match[1];
    const emoji = leadingEmoji(text);
    if (emoji && set.has(iconKey(emoji))) continue;

    const clean = emoji ? text.slice(emoji.length).trimStart() : text;
    const icon = iconFor(clean, 2);
    if (!ICON_RULES.some(([pattern]) => pattern.test(clean))) {
      stats.fallback.push(`${relative('content', file)} :: ${clean}`);
    }
    lines[i] = `## ${icon} ${clean}`;
    if (emoji) stats.badIcon += 1;
    else stats.h2 += 1;
  }

  const withLanguage = neutralSpanish(lines, stats);
  const withoutIndex = removeIndexSections(withLanguage, stats);
  const withCallouts = convertCallouts(withoutIndex, stats);
  const output = `---\n${newFront}\n---\n\n${withCallouts.join('\n').replace(/^\n+/, '')}`;

  if (output !== raw) {
    stats.files += 1;
    if (!dryRun) writeFileSync(file, output);
  }
}

console.log(
  `Migrados: ${stats.files} archivos | h2 iconados: ${stats.h2} | iconos reemplazados: ${stats.badIcon} | idioma: ${stats.language} | índices: ${stats.indexes} | callouts: ${stats.callouts}`,
);
if (stats.fallback.length > 0) {
  console.log(`\nIconos de fallback (revisar significado): ${stats.fallback.length}`);
  for (const item of stats.fallback) console.log(`  - ${item}`);
}
