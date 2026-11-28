---
title: "🧩 Escenario: cliente NTP mal apuntado — chrony sin sincronizar"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "time"
  - label: "Herramientas"
    value: "`chronyc`, chrony, Docker"
  - label: "Archivos"
    value: "`labs/time/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/time"
        label: "Laboratorio de tiempo"
---

# 🧩 Escenario: cliente NTP mal apuntado — chrony sin sincronizar

---

## 🎯 Problema

El cliente tiene chrony en marcha, pero no sincroniza:

```text
Reference ID    : 00000000 ()
Stratum         : 0
Leap status     : Not synchronised
```

En `chronyc sources` la fuente aparece como `^?` o no aparece. El servidor NTP existe y responde a otros clientes; el problema es la configuración del cliente.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/time
./scripts/break.sh 02
docker compose exec time-client chronyc tracking
```

---

## ✅ Salida esperada

- `Leap status: Not synchronised`.
- `chronyc sources -v` muestra `^? ntp-offline` o un nombre que no resuelve.
- En los logs del cliente:
  ```text
  Failed to resolve address for ntp-offline
  ```
- El servidor `ntp-server` sigue sano; el cliente no lo está consultando.

---

## 🧠 Diagnóstico

`chronyd` lee la lista de fuentes de su configuración (`/etc/chrony/client.conf` o `/etc/chrony/chrony.conf`). Si el nombre no resuelve, el puerto UDP/123 está bloqueado o el servidor no responde, la fuente queda inservible.

Orden de diagnóstico:

1. **Configuración**: `grep -v '^#' /etc/chrony/*.conf`.
2. **Resolución**: `getent hosts ntp-server`.
3. **Conectividad UDP**: `nc -u -z -w 2 ntp-server 123` (si está disponible) o revisar firewall.
4. **Estado de chrony**: `chronyc sources -v`, `chronyc tracking`, `chronyc activity`.
5. **Logs**: `docker compose logs time-client`.

En el laboratorio, `break.sh 02` cambia `ntp-server` por `ntp-offline` y reinicia el cliente.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el fallo

```bash
cd public/labs/time
./scripts/break.sh 02
docker compose exec time-client chronyc sources -v
docker compose exec time-client chronyc tracking
```

### 2. Revisar la configuración

```bash
docker compose exec time-client sh -c 'grep -v "^#" /etc/chrony/client.conf'
```

Debe apuntar a `ntp-server`, no a `ntp-offline`.

### 3. Corregir la fuente

La forma rápida es restaurar la copia que dejó el laboratorio:

```bash
docker compose exec time-client cp /etc/chrony/client.conf.bak /etc/chrony/client.conf
docker compose restart time-client
```

O edita el archivo:

```text
server ntp-server iburst minpoll 4 maxpoll 4
```

### 4. Esperar la sincronización

```bash
sleep 20
docker compose exec time-client chronyc tracking
docker compose exec time-client chronyc sources -v
```

Debe aparecer `^* ntp-server` y `Leap status: Normal`. Si no, revisa los logs:

```bash
docker compose logs --tail=50 time-client
```

### 5. Verificar el conjunto

```bash
./scripts/verify.sh
```

---

## 🧯 Mitigación

- Si el servidor preferido no responde, añade fuentes secundarias (`server ntp2 ...`).
- Si el DNS interno falla, usa direcciones IP estables o un nombre con resolución garantizada.
- Si hay firewall, abre UDP/123 solo hacia los servidores NTP permitidos.
- Si el cliente lleva mucho tiempo sin sincronizar, revisa el offset antes de forzar un paso (`chronyc makestep`).
- Si el reloj está muy desviado, algunos protocolos (TLS, Kerberos) pueden fallar antes de que NTP corrija.

---

## ✅ Verificación

- `chronyc sources -v` muestra una fuente con `^*` y `Reach` distinto de 0.
- `chronyc tracking` muestra `Leap status: Normal`.
- `./scripts/verify.sh` termina sin error.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Configura al menos dos fuentes NTP y monitoriza su estado.
- Versiona `/etc/chrony/` y valida los cambios en staging.
- Alerta si `chronyc tracking` no está `Normal` durante más de X minutos.
- Documenta los servidores NTP internos y su ACL.
- No uses nombres que solo resuelvan en una red concreta para todos los entornos.
- Revisa el offset y el stratum tras un cambio de red.

---

## ⚠️ Qué no hacer

- **No ejecutes `chronyc makestep` a ciegas** en un servidor con servicios sensibles; primero mide el offset.
- **No desactives chrony** para que “deje de fallar”.
- **No uses servidores NTP públicos** sin política ni rate limiting.
- **No ignores el DNS**: un fallo de resolución parece un fallo de NTP.
- **No cambies la hora a mano** y esperes que chrony no lo note.

---

## 🔗 Referencias internas

- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — cliente, servidor y reset.
- [Escenario: servidor NTP caído](/learning-sys-admin-guides-web/scenarios/time/03-ntp-server-down/) — cuando la fuente desaparece.
- [Escenario: ACL NTP bloqueada](/learning-sys-admin-guides-web/scenarios/time/04-ntp-acl-blocked/) — cuando el servidor no responde al cliente.
