---
title: "🧩 Escenario: Auditoría de archivos SUID y permisos inseguros"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "security"
  - label: "Herramientas"
    value: "`find`, `xargs`, `awk`, `sort`, `diff`, `ls`"
  - label: "Archivos"
    value: "Sistema de archivos en vivo (`/`)"
---

# 🧩 Escenario: Auditoría de archivos SUID y permisos inseguros

---

## 🎯 Problema

Es necesario auditar el sistema para detectar configuraciones inseguras de permisos que puedan permitir escalada de privilegios o comprometer la integridad del sistema. Para ello, se requiere:

- encontrar archivos con permisos SUID/SGID que permitan escalada de privilegios
- detectar cambios en la lista de SUID entre snapshots
- identificar directorios world-writable, archivos sin dueño y enlaces rotos

---

## ⚡ Quick command (SRE)

`find / -type f -perm -4000 2>/dev/null | head -50`

---

## ✅ Salida esperada

```text
-rwsr-xr-x root root /usr/bin/passwd
-rwsr-xr-x root root /usr/bin/su
-rwsr-xr-x root root /usr/bin/sudo
```

Interpretación:

- binarios conocidos con SUID → comportamiento esperado
- binarios no estándar con SUID → posible riesgo de escalada
- scripts con SUID → crítico (ejecución como root)
- cambios recientes → posible compromiso

---

## 🧠 Diagnóstico

Los archivos con SUID permiten ejecutar un binario con los permisos del dueño (generalmente root).

Esto introduce riesgo de escalada de privilegios si el binario no es confiable o está mal configurado.

👉 Un SUID inesperado debe considerarse sospechoso hasta ser validado.

---

## 🛠️ Validación extendida

### Archivos SGID

```bash
find / -type f -perm -2000 2>/dev/null | xargs -I {} ls -la {} | awk '{ print $1, $3, $4, $NF }'
```

### Detectar cambios en SUID (snapshot)

```bash
# Snapshot inicial
find / -type f -perm -4000 2>/dev/null | sort > /tmp/suid_before.txt
# ... después de cambios ...
find / -type f -perm -4000 2>/dev/null | sort > /tmp/suid_after.txt
# Comparar
diff /tmp/suid_before.txt /tmp/suid_after.txt | awk '{ if($1==">")print "AÑADIDO:", $2; if($1=="<")print "ELIMINADO:", $2 }'
```

### Directorios world-writable

```bash
find / -type d -perm -o+w 2>/dev/null | grep -v "^/proc\|^/sys\|^/dev" | head -30 | xargs -I {} ls -ld {} | awk '{ print $1, $NF }'
```

### Archivos sin dueño ni grupo

```bash
find / -type f \( -nouser -o -nogroup \) 2>/dev/null | xargs -I {} ls -la {} | awk '{ print $1, $3, $4, $NF, "-> ORPHAN" }'
```

### Archivos con permisos 777

```bash
find / -type f -perm 777 2>/dev/null | head -30 | xargs -I {} ls -la {} | awk '{ print $1, $NF }'
```

### Enlaces simbólicos rotos

```bash
find / -type l ! -exec test -e {} \; 2>/dev/null -print | head -20 | while read l; do echo "ROTO: $l -> $(readlink "$l")"; done
```

---

## 🧯 Mitigación

Eliminar SUID en archivo sospechoso:

```bash
chmod u-s <archivo>
```

Verificar:

```bash
ls -l <archivo>
```

Rollback (si es necesario restaurar):

```bash
chmod u+s <archivo>
```

👉 Validá siempre antes de modificar permisos en binarios del sistema.

---

## ✅ Prevención

- [ ] Monitorear cambios en SUID con `aide` o `tripwire`
- [ ] Script de auditoría semanal en cron
- [ ] Política: "ningún script debe tener SUID"
- [ ] Usar `capabilities` de Linux en vez de SUID cuando sea posible

---

## 🧪 Variantes

### Buscar SUID en directorios específicos

```bash
find /usr/local /opt /home -type f -perm -4000 2>/dev/null
```

### Chequear sticky bit en /tmp

```bash
ls -ld /tmp | awk '{ print $1 }'
# Si no tiene 't' al final, falta sticky bit
```

---

## 🎓 Modo docente

**Preguntas:** ¿Por qué `nmap` con SUID es peligroso? ¿Qué es un ataque TOCTOU con enlaces simbólicos?
**Ejercicio:** Hacer snapshot de SUID, instalar un paquete, detectar los cambios. Proponer una política de monitoreo automático.
**Evaluación:** identificación correcta de SUID peligroso, snapshot funcional, mitigación sin romper el sistema.

---

## 🧪 Cómo practicarlo en el lab

```bash
cd labs && docker compose -f docker-compose.from-scratch.yml up -d ubuntu-bare
# Auditar SUID dentro del contenedor
docker exec -it ubuntu-bare bash
find / -type f -perm -4000 2>/dev/null | head -20
```


---

## 🔗 Referencias

- [`guides/find.md`](/learning-sys-admin-guides-web/guides/find/) — `-perm`, `-nouser`, `-nogroup`
- [`guides/xargs.md`](/learning-sys-admin-guides-web/guides/xargs/) — ejecución sobre resultados
- [`guides/awk.md`](/learning-sys-admin-guides-web/guides/awk/) — formateo y filtrado
- [`guides/sort.md`](/learning-sys-admin-guides-web/guides/sort/) — ordenamiento
- [`diff`](/learning-sys-admin-guides-web/guides/diff/) — comparar el inventario SUID contra la baseline
