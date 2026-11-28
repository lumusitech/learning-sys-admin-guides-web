---
title: "🛠️ fuser — Guía completa"
level: "Intermedio"
section: "guides"
meta:
  - label: "Archivos de práctica"
    value: "Sistema en vivo"
  - label: "Ver escenarios relacionados"
    links:
      - id: "scenarios/networking/08-firewall-blocked-port"
        label: "networking/08-firewall-blocked-port"
      - id: "scenarios/system/04-high-cpu-runaway-process"
        label: "system/04-high-cpu-runaway"
---

# 🛠️ fuser — Guía completa

---

## ⚡ Quick command

`fuser -v 80/tcp`

---

## ⚡ Quick run

```bash
fuser 80/tcp && fuser -k 80/tcp
```

:::callout{state=warning label="Atención"}
`fuser` requiere `psmisc` en Debian/Ubuntu o está disponible en BusyBox. En Alpine: `apk add psmisc`.
:::

---

---

## 🧠 ¿Qué es fuser?

**fuser** identifica procesos que están usando archivos, sockets, o sistemas de archivos. Es la alternativa liviana a `lsof` — más portable (incluido en BusyBox), más rápida, y orientada a acciones (matar procesos por puerto o archivo).

Se usa para:

- saber qué proceso ocupa un puerto;
- matar procesos que bloquean un archivo o directorio;
- verificar qué procesos están usando un sistema de archivos antes de desmontarlo.

---

## 🧠 Modelo mental

`fuser` responde dos preguntas:

1. **¿Quién está usando este recurso?** → `fuser -v 80/tcp` muestra los PIDs.
2. **¿Lo mato?** → `fuser -k 80/tcp` envía SIGKILL (o la señal que elijas) a esos PIDs.

Mientras `lsof` es un listador (muestra archivos abiertos), `fuser` es un localizador + ejecutor. En sistemas mínimos (Alpine, contenedores), `fuser` suele estar disponible cuando `lsof` no.

---

## 📝 Sintaxis básica

```bash
fuser [opciones] <recurso>
```

```bash
fuser 80/tcp                    # PIDs usando el puerto 80 TCP
fuser -v 80/tcp                 # Verbose: PID + comando
fuser -k 80/tcp                 # Mata procesos en puerto 80
fuser /var/log/syslog           # PIDs usando este archivo
fuser -m /mnt/disco             # PIDs usando este mount point
```

---

## 🔑 Salida clave

```text
$ fuser 80/tcp
80/tcp:               1234  1235

$ fuser -v 80/tcp
                     USER        PID ACCESS COMMAND
80/tcp:              root       1234 F.... nginx
                     www-data   1235 F.... nginx
```

| Elemento | Significado |
|----------|-------------|
| `80/tcp` | Recurso consultado |
| `1234` | PID del proceso que lo usa |
| `ACCESS` | Tipo de acceso (`F`=open file, `r`=root, `c`=cwd) |
| `COMMAND` | Nombre del proceso (solo con `-v`) |

---

## 🎛️ Opciones principales

| Opción | Efecto |
|--------|--------|
| `-v` | Verbose: muestra usuario, PID, acceso y comando |
| `-k` | Mata los procesos encontrados (envía SIGKILL por defecto) |
| `-<señal>` | Señal específica con `-k`: `fuser -k -15 80/tcp` |
| `-n <proto>` | Espacio de nombres: `tcp`, `udp`, `file` (por defecto auto) |
| `-m` | Incluye montajes: muestra procesos en un sistema de archivos montado |
| `-s` | Silencioso: solo código de salida (útil en scripts) |
| `-u` | Muestra usuario (implícito en `-v`) |

---

## ⚙️ Identificar procesos por puerto

```bash
# TCP
fuser 80/tcp
fuser -v 80/tcp

# UDP
fuser 53/udp

# Rango de puertos
fuser 80-100/tcp

# Todos los puertos en escucha
fuser -v -n tcp 1-1024

# Solo verificar si hay proceso (sin listar)
fuser -s 80/tcp && echo "ocupado" || echo "libre"
```

---

## ⚙️ Identificar procesos por archivo

```bash
# Archivo regular
fuser -v /var/log/syslog

# Directorio
fuser -v /var/log

# Mount point (antes de desmontar)
fuser -v -m /mnt/usb

# Todos los archivos abiertos en un directorio (recursivo implícito con -m)
fuser -v -m /var
```

---

## 🔍 Uso en troubleshooting

### "Port already in use"

```bash
# 1. ¿Qué proceso ocupa el puerto?
fuser -v 8080/tcp

# 2. Matarlo graceful
fuser -k -15 8080/tcp

# 3. Si no responde, forzar
fuser -k 8080/tcp
```

### "Device or resource busy" al desmontar

```bash
# 1. Ver qué procesos usan el mount
fuser -v -m /mnt/usb

# 2. Matar o notificar a los procesos
fuser -k -15 -m /mnt/usb

# 3. Desmontar
umount /mnt/usb
```

### Archivo en uso que no se puede borrar

```bash
# ¿Quién lo retiene?
fuser -v /tmp/archivo.tmp

# Matar proceso si es seguro
fuser -k /tmp/archivo.tmp
```

---

## 🛠️ Combinación con otras herramientas

### fuser + kill: matar por puerto

```bash
fuser -k 80/tcp                       # SIGKILL directo
fuser -k -15 80/tcp                   # SIGTERM primero
```

### fuser + pgrep: confirmar antes de matar

```bash
fuser -v 80/tcp 2>&1 | grep -q nginx && kill -15 $(fuser 80/tcp 2>&1 | awk '{print $NF}') 
```

### fuser + while: esperar a que un puerto se libere

```bash
while fuser -s 8080/tcp; do sleep 1; done && echo "Puerto libre"
```

---

## 💡 Uno-liners imprescindibles

```bash
fuser -v 80/tcp                       # ¿Quién escucha en puerto 80?
fuser -k 8080/tcp                     # Matar proceso en puerto 8080
fuser -k -15 3306/tcp                 # SIGTERM al proceso en puerto 3306
fuser -v -m /var                      # Procesos usando /var
fuser -v -m /mnt/backup               # Procesos usando mount de backup
fuser -s 80/tcp && echo "ocupado"     # Verificar sin salida
fuser -v -n tcp 1-1024                # Puertos privilegiados en uso
```

---

## ⚠️ Errores comunes

- **Usar `fuser` sin `-v` para diagnóstico humano**. Sin verbose solo ves PIDs. Para entender qué procesos son, usar `fuser -v`.
- **`fuser -k` envía SIGKILL por defecto**. No SIGTERM. Si quieres terminación graceful, usar `fuser -k -15 <recurso>`.
- **No estar instalado**. `fuser` pertenece a `psmisc`. En Alpine: `apk add psmisc`. En BusyBox suele estar disponible como applet.
- **Confundir `fuser` con `lsof`**. `fuser` es para localizar y matar procesos por recurso. `lsof` es para listar todos los archivos abiertos. `fuser` es más rápido y directo.
- **Matar procesos sin confirmar**. Siempre verificar con `fuser -v` antes de `fuser -k`.

---

## ✅ Buenas prácticas

- **Siempre verificar con `-v` antes de matar**. Saber qué proceso estás matando evita accidentes.
- **Preferir `fuser -k -15` sobre `fuser -k` solo**. SIGTERM permite limpieza ordenada. SIGKILL es la última opción.
- **Usar `fuser -s` en scripts** para verificar ocupación sin generar salida.
- **Antes de desmontar un disco**, siempre ejecutar `fuser -v -m <mount>` — revela qué procesos retienen el dispositivo.
- **En entornos con `lsof` no disponible** (contenedores mínimos, Alpine), `fuser` es tu alternativa principal.
- **Combinar con `sleep` en loops** para esperar liberación de puertos en scripts de deployment.

---

## 🔗 Referencias internas

- [`lsof`](/learning-sys-admin-guides-web/guides/lsof/) — listado completo de archivos abiertos (alternativa pesada)
- [`ip_ss`](/learning-sys-admin-guides-web/guides/ip_ss/) — conexiones de red con `ss`
- [`kill`](/learning-sys-admin-guides-web/guides/kill/) — señales a procesos (SIGTERM, SIGKILL, SIGHUP)
- [`ps`](/learning-sys-admin-guides-web/guides/ps/) — procesos del sistema
