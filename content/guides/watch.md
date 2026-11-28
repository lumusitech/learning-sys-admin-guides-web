---
title: "🛠️ watch — Guía completa"
level: "Básico"
section: "guides"
meta:
  - label: "Archivos de práctica"
    value: "Sistema en vivo"
  - label: "Ver escenarios relacionados"
    links:
      - id: "scenarios/system/04-high-cpu-runaway-process"
        label: "system/04-high-cpu-runaway-process.md"
      - id: "scenarios/system/10-swap-exhaustion"
        label: "system/10-swap-exhaustion.md"
      - id: "scenarios/infrastructure/06-raid-degradation"
        label: "infrastructure/06-raid-degradation.md"
---

# 🛠️ watch — Guía completa

---

## ⚡ Quick command

`watch -n 2 'ps aux --sort=-%cpu | head -10'`

:::callout{state=warning label="Atención"}
`watch` no está disponible en BusyBox/Alpine por defecto. Instalar con `apk add procps` o usar `while true; do <comando>; sleep 2; done` como alternativa POSIX.
:::

---

## ⚡ Quick run

```bash
watch -n 5 'free -h && echo "---" && df -h'
```

---

---

## 🧠 ¿Qué es watch?

`watch` ejecuta un comando periódicamente y muestra su salida en pantalla, resaltando los cambios entre ejecuciones.

- qué hace: repite un comando cada N segundos y muestra la salida
- para qué sirve: monitorear cambios en tiempo real sin ejecutar manualmente el mismo comando
- cuándo usarlo: cuando quieres ver cómo evoluciona algo (memoria, procesos, RAID rebuild)
- cuándo NO usarlo: para análisis de logs (usar `tail -f`) o para scripts largos (usar `cron`)

---

## 🧠 Modelo mental

`watch` es como un "auto-refresh" de la terminal. Ejecuta el comando, muestra la salida, espera N segundos, y repite. Resalta los cambios en negrita para que veas qué cambió.

Piensalo así:

- `tail -f` → sigue un archivo que cambia
- `watch` → repite un comando que cambia su resultado
- `cron` → ejecuta algo periódicamente en segundo plano

`watch` es para monitoreo interactivo. Si necesitas ejecutar algo periódicamente en segundo plano, usá `cron`.

---

## 📝 Sintaxis básica

```bash
watch [opciones] <comando>
watch [opciones] '<comando con pipes>'
```

Si el comando tiene pipes o redirecciones, usar comillas simples.

---

## 🔑 Salida clave

`watch` muestra:

```text
Every 2.0s: <comando>    <hostname>    <fecha/hora>

<salida del comando>
```

La primera línea muestra:

- intervalo de ejecución
- comando ejecutado
- hostname
- timestamp

Los cambios entre ejecuciones se resaltan en negrita.

---

## 🎛️ Opciones principales

| Opción | Descripción |
|--------|-------------|
| `-n <segundos>` | Intervalo entre ejecuciones (default: 2 segundos) |
| `-d` | Resaltar diferencias entre ejecuciones |
| `-d=cumulative` | Resaltar todas las diferencias acumuladas |
| `-t` | Ocultar la primera línea (header) |
| `-b` | Sonido de beep cuando el comando termina con error |
| `-e` | Salir si el comando devuelve error |
| `-p` | Salir si el comando devuelve error (alternativa a -e) |
| `-x` | Ejecutar con `exec` en vez de `sh` |
| `-c` | Usar colores ANSI |
| `--no-title` | Sin título (alternativa a -t) |

---

## 📋 Patrones de uso

### Monitorear memoria

```bash
watch -n 2 'free -h'
```

### Monitorear espacio en disco

```bash
watch -n 5 'df -h'
```

### Monitorear procesos por CPU

```bash
watch -n 2 'ps aux --sort=-%cpu | head -10'
```

### Monitorear procesos por memoria

```bash
watch -n 2 'ps aux --sort=-%mem | head -10'
```

### Monitorear estado de RAID

```bash
watch -n 5 'cat /proc/mdstat'
```

### Monitorear conexiones de red

```bash
watch -n 2 'ss -s'
```

### Monitorear swap

```bash
watch -n 2 'free -h && vmstat 1 1'
```

---

## 🔍 Uso en troubleshooting

### Verificar que un proceso se está consumiendo más memoria

```bash
watch -n 5 'ps -p <PID> -o pid,rss,vsz,cmd'
```

### Verificar progreso de reconstrucción de RAID

```bash
watch -n 10 'cat /proc/mdstat'
```

### Verificar que swap está creciendo

```bash
watch -n 5 'free -h'
```

### Verificar que el OOM killer está actuando

```bash
watch -n 5 'dmesg | grep -i oom | tail -5'
```

### Verificar conexiones activas

```bash
watch -n 2 'ss -s'
```

---

## 🛠️ Combinación con otras herramientas

### Con free (monitorear memoria)

```bash
watch -n 2 'free -h'
```

### Con df (monitorear disco)

```bash
watch -n 5 'df -h'
```

### Con ps (monitorear procesos)

```bash
watch -n 2 'ps aux --sort=-%cpu | head -10'
```

### Con cat /proc/mdstat (monitorear RAID)

```bash
watch -n 10 'cat /proc/mdstat'
```

### Con vmstat (monitorear I/O)

```bash
watch -n 2 'vmstat 1 1'
```

---

## 💡 Uno-liners imprescindibles

```bash
# Monitorear memoria cada 2 segundos
watch -n 2 'free -h'

# Monitorear disco cada 5 segundos
watch -n 5 'df -h'

# Monitorear top 10 procesos por CPU
watch -n 2 'ps aux --sort=-%cpu | head -10'

# Monitorear RAID rebuild
watch -n 10 'cat /proc/mdstat'

# Monitorear conexiones de red
watch -n 2 'ss -s'

# Monitorear swap
watch -n 2 'free -h | grep Swap'

# Monitorear un proceso específico
watch -n 5 'ps -p <PID> -o pid,rss,vsz,cmd'

# Monitorear logs de errores recientes
watch -n 5 'dmesg --level=err | tail -10'

# Monitorear espacio en directorio específico
watch -n 10 'du -sh /var/log'

# Sin título (para scripts)
watch -t -n 2 'free -h'
```

---

## ⚠️ Errores comunes

### No usar comillas con pipes

`watch ls | head` ejecuta `watch ls` y pipea a `head`. Usar `watch 'ls | head'`.

### Intervalo muy corto

`watch -n 0` no tiene sentido. El mínimo razonable es 1 segundo.

### Olvidar que watch no está en Alpine

`watch` no está en BusyBox. Usar alternativa POSIX: `while true; do <comando>; sleep 2; done`.

### Confundir watch con tail -f

`watch` repite un comando. `tail -f` sigue un archivo. Para logs, `tail -f` es mejor.

### No resaltar diferencias

Sin `-d`, los cambios no se resaltan. Usar `-d` para ver qué cambió.

---

## ✅ Buenas prácticas

- usar `-n 2` o `-n 5` como intervalo razonable (no más rápido que 1 segundo)
- usar `-d` para ver cambios resaltados
- usar comillas simples cuando el comando tiene pipes o redirecciones
- usar `-t` en scripts para ocultar el header
- alternativa POSIX para Alpine: `while true; do <comando>; sleep 2; done`

---

## 🔗 Referencias internas

- [`free`](/learning-sys-admin-guides-web/guides/free/) — memoria y swap
- [`df`](/learning-sys-admin-guides-web/guides/df/) — espacio en disco
- [`top`](/learning-sys-admin-guides-web/guides/top/) — monitoreo de procesos
- [`vmstat`](/learning-sys-admin-guides-web/guides/vmstat/) — CPU, memoria, I/O
