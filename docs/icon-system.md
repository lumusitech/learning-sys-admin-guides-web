# Sistema de iconos

Regla de oro: **un icono = un significado**. El lector debe poder asociar el icono
con lo que va a encontrar incluso sin leer el título. Si un icono nuevo no existe
en este set, se agrega aquí **antes** de usarlo, con su significado único.

## Cómo se aplica

- **Título de página** (frontmatter `title`): el icono del tema de la guía.
- **`h2`**: la categoría de la sección.
- **`h3`**: el detalle dentro de la categoría.
- Siempre con un espacio después del icono: `## 🧠 ¿Qué es?`.
- No se repite un icono con dos significados distintos. Se permiten "familias"
  cuando el matiz es el mismo (por ejemplo 💾 = respaldo en cualquier contexto,
  🔐 = seguridad/integridad/permisos).

El lint `pnpm lint:icons` (corre en CI) falla si un título no tiene icono, si usa
uno fuera de este set o si falta el espacio. El set se lee de este archivo.

## Set canónico

<!-- icon-set:start -->
| Icono | Significado | Uso típico |
|-------|-------------|------------|
| ⚡ | Atajo / comando rápido | `Quick command`, `Quick run` |
| 📑 | Índice / tabla de contenidos | `Índice` |
| 🔑 | Salida clave | `Salida clave` |
| 📝 | Sintaxis | `Sintaxis básica` |
| 🎛️ | Opciones y configuración | `Opciones principales` |
| 📌 | Mensajes clave / resumen | `Mensajes de resumen` |
| 🧪 | Simulación / prueba | `Salidas simuladas` |
| 💡 | Uno-liners y consejos | `Uno-liners` |
| 🔗 | Referencias y enlaces | `Ver también`, `Referencias` |
| 📋 | Lista de métodos o patrones | `Métodos`, `Patrones de uso` |
| 🧠 | Concepto, modelo mental o memoria | `¿Qué es?`, `Memoria` |
| 🧩 | Conceptos clave / escenario | `Conceptos clave` |
| 🗺️ | Flujo o mapa | `Flujo de diagnóstico` |
| 🔄 | Ciclo / proceso iterativo | `Cómo encaja`, `Proceso iterativo` |
| 📊 | Datos, patrones y verificación de recursos | `Patrones normal vs anómalo` |
| ⚖️ | Comparación / balance | `Normal vs anómalo`, comparar A vs B |
| 🔍 | Embudo / troubleshooting | `Uso en troubleshooting` |
| 🔎 | Reducción / búsqueda acotada | `Reducción del problema` |
| 🩺 | Síntoma | `El síntoma` |
| 👀 | Observar | Paso de observación |
| 🎯 | Objetivo / foco | `Problema`, `¿Por qué importa?` |
| 🕓 | Tiempo / historial / cambios recientes | `Qué cambió`, archivos modificados |
| 🎓 | Lecciones aprendidas | `Lecciones del caso` |
| 📖 | Caso de estudio | `Caso de estudio` |
| 🤔 | Duda / caso a investigar | Preguntas de diagnóstico |
| 🧭 | Rumbo / patrón de trabajo | `Patrones de uso` |
| 🖥️ | CPU / host | `CPU` |
| 💽 | Disco / almacenamiento de bloques | `Disco` |
| ⚙️ | Procesos / servicios | `Procesos` |
| 🌐 | Red (concepto) | `Red` |
| 📡 | Señales y telemetría | `Señales del sistema` |
| 🔌 | Puertos / conectividad | `Puertos de sistema` |
| 🔴 | Nivel crítico | Rangos privilegiados (0-1023) |
| 🟡 | Nivel medio | Rangos de aplicación (1024-49151) |
| 🐧 | Variante Linux / Alpine | `Variante Alpine` |
| 💾 | Respaldo / backup | Verificar o restaurar backups |
| 📦 | Inventario / paquetes | Comparar inventarios |
| 📁 | Archivo | Archivos sueltos |
| 📂 | Directorio / árbol | Árboles de directorios |
| 🔢 | Binario / datos numéricos | `diff` con binarios |
| 🔬 | Inspección fina | Binarios, hashes |
| 📄 | Formato normal | Salida por defecto |
| 🧾 | Formato unificado | `-u` |
| 📜 | Formato contexto / histórico | `-c` |
| 🔀 | Diff / comparación de cambios | Título de la guía `diff` |
| ⚠️ | Errores comunes / advertencia | `Errores comunes` |
| 🚫 | Qué no hacer / límite | `Ignorar el exit code` |
| 🧨 | Trampa / bug sutil | `set -e` con diferencias |
| 🩹 | Parche / corrección puntual | Aplicar un parche |
| 🔇 | Filtrar ruido | `Filtrar ruido` |
| 🙈 | Ruido / exceso de información | Demasiadas diferencias |
| 🔐 | Seguridad / permisos / integridad | SUID, permisos, checksums |
| 🕵️ | Investigación (quién / cuándo) | `Quién hizo el cambio` |
| 🌿 | Git / ramas | Repos versionados |
| ♻️ | Restaurar / revertir | `Restaurar archivos` |
| 🧯 | Mitigación / contención | `Mitigación` |
| 🛠️ | Procedimiento / herramientas | `Procedimiento`, `Combinación` |
| ✅ | Verificación / buenas prácticas | `Buenas prácticas`, `Interpretación` |
<!-- icon-set:end -->
