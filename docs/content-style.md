# Estilo de contenido

Reglas de idioma y redacción para las guías, el copy de UI y la documentación.

## Idioma

- **Español neutro**, sin voseo ni regionalismos. El objetivo es un español que
  se lea natural en España y en toda Latinoamérica.
- **Instrucciones en "tú" imperativo neutro**: "ejecuta", "revisa". No se usa
  voseo ("ejecutá", "revisá") ni formas impersonales ("se ejecuta").
- **Sin léxico regional**: evitar "acá" (usar "aquí"), "che", "lindo",
  "bárbaro", "posta", "laburo", "guita", "ni idea".
- Una sola variedad por documento: no se mezcla voseo con neutro en el mismo archivo.

## Conversión rápida

| Voseo | Neutro |
| --- | --- |
| tenés, podés, querés, sabés, sos | tienes, puedes, quieres, sabes, eres |
| entendés, comparás, enfrentás, descartás, observás, resolvés, abrís | entiendes, comparas, enfrentas, descartas, observas, resuelves, abres |
| usá, guardá, verificá, normalizá, copiá, pensá, tocá, agregá, quitá | usa, guarda, verifica, normaliza, copia, piensa, toca, agrega, quita |
| mirá, contá, nombrá, tratá, documentá, ejecutá, buscá, evitá, filtrá | mira, cuenta, nombra, trata, documenta, ejecuta, busca, evita, filtra |
| escribí, resolvé, reducí, pedí, capturá, aceptá, elevá | escribe, resuelve, reduce, pide, captura, acepta, eleva |
| limitá, rechazá, fallá, mantené, corré, sacá | limita, rechaza, falla, mantén, corre, saca |
| fijate, acordate, olvidate, quedate, dale, decime, contame | fíjate, acuérdate, olvídate, quédate, dime, cuéntame |
| vos | tú (o se omite: el imperativo ya marca el sujeto) |

## Qué no se traduce

- **Comandos, flags, rutas, nombres de archivos y salidas de consola**: se dejan
  tal cual, incluso dentro de una frase en español.
- **Términos técnicos asentados en inglés** (`deployment`, `rollback`,
  `exit code`, `log`, `baseline`): se mantienen; si el término es nuevo, se
  puede aclarar en español entre paréntesis la primera vez.
- No se mezclan idiomas fuera de lo técnico: la prosa va en español neutro.

## Verificación

- `pnpm lint:language` recorre `content/`, `docs/` y `README.md` y falla si
  encuentra voseo o regionalismos. Corre en CI junto a `lint:icons`.
- El lint usa límites Unicode: también detecta imperativos con vocal acentuada
  (`limitá`, `cerrá`), no solo formas terminadas en consonante.
- El lint ignora los bloques de código y este mismo documento (que cita las
  formas voseo como referencia).
- Checklist antes de la PR:
  - [ ] Sin voseo ("corré", "tenés", "fijate").
  - [ ] Sin regionalismos ("acá", "che", "lindo").
  - [ ] Instrucciones en "tú" imperativo neutro.
  - [ ] Términos técnicos en inglés sin traducir.
