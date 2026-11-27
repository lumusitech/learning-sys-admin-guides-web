# Plantilla de guide

Copia este esqueleto para un guide nuevo. Los iconos **no son libres**: salen de
[`docs/icon-system.md`](./icon-system.md) y se validan con `pnpm lint:icons`.
El lint también exige icono en el `title` del frontmatter.

Reglas rápidas:

- Un icono = un significado (ver el set canónico).
- Español neutro con "tú" imperativo ("guarda", "usa", "ejecuta"); sin voseo ni regionalismos.
- Un idea por sección; el resto va en subsecciones `h3`.
- Todo comando con salida breve puede llevar una simulación (`:::sim`).
- Los metadatos del encabezado (requisitos, herramientas, archivos, enlaces) van en
  `meta:` del frontmatter; no los escribas a mano en el cuerpo.
- Para advertencias usa `:::callout{state=warning|tip|danger label="..."}` en vez de blockquotes.
- El orden de la navegación sigue la ruta del archivo (`id`). Si necesitas un orden
  pedagógico, usa prefijos numéricos en el nombre (`01-...`, `02-...`).

---

```md
---
title: "⚡ nombre — Qué resuelve en una frase"
level: "Básico" # Básico | Intermedio | Avanzado
section: "guides" # guides | scenarios | concepts | reference
meta:
  - label: "Requisitos"
    value: "acceso a un host Linux con `herramienta` instalada"
  - label: "Ver escenarios relacionados"
    links:
      - id: "scenarios/system/01-..."
        label: "system/01-..."
---

# ⚡ nombre — Qué resuelve en una frase

---

## ⚡ Quick command

`herramienta --opcion /ruta/al/archivo`

:::callout{state=warning label="Atención"}
Advertencia clave sobre exit codes, permisos o efectos secundarios.
:::

---

## 🧠 ¿Qué es?

Dos o tres párrafos. Modelo mental antes que sintaxis.

---

## 📝 Sintaxis básica

```bash
herramienta --flag archivo
```

---

## 🔑 Salida clave

```text
salida típica con lo importante resaltado en el texto de abajo
```

- Qué significa cada parte.
- Cuándo es normal y cuándo no.

:::sim{state=success label="Caso exitoso"}
```console
$ herramienta --flag archivo
salida esperada
```
Qué confirma esta salida y cuál es el siguiente paso.
:::

:::sim{state=error label="Caso de error"}
```console
$ herramienta --flag archivo
mensaje de error típico
```
Qué significa el error y cómo se corrige. No lo dejes sin explicación.
:::

---

## 🎛️ Opciones principales

<!-- cards -->
| Opción | Qué hace | Cuándo usarla |
|--------|----------|---------------|
| `-a` | ... | ... |
| `-b` | ... | ... |

---

## 📋 Patrones de uso

### 🧭 1. Patrón con nombre

```bash
herramienta ...
```

---

## 🔍 Uso en troubleshooting

### 🤔 "Síntoma que describe el usuario"

```bash
# qué mirar primero
herramienta --debug
```

---

## ⚠️ Errores comunes

### 🧨 1. Error frecuente

Explicación y corrección.

---

## ✅ Buenas prácticas

- ...

---

## 🔗 Referencias internas

- [`guia-relacionada`](../guides/guia-relacionada.md) — por qué se relaciona
```

---

## Antes de abrir la PR

- [ ] `pnpm lint:icons` en verde (todos los títulos con icono del set).
- [ ] `pnpm check` y `pnpm build` en verde.
- [ ] `pnpm test:all` en verde (unitarios + e2e).
- [ ] Simulaciones de éxito **y** de error en los comandos clave.
- [ ] Tablas con `<!-- cards -->` sólo si son comparaciones: el resto van como tabla normal.
- [ ] Probado en móvil (320-412 px): sin scroll horizontal de página, tablas con scroll propio.
- [ ] Español neutro (tú imperativo): sin voseo ni regionalismos.
