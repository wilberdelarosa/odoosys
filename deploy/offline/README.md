# Bundle Offline de Imágenes Docker

Estas herramientas resuelven el único bloqueador real para instalar el sistema
**sin internet** en una máquina nueva: las imágenes Docker (`postgres:15`,
`odoo:17.0`) que normalmente se descargan de internet en la primera instalación.

La idea es simple y robusta:

1. En una máquina **con internet** (una sola vez) corres `Crear-Bundle-Offline.ps1`.
   Eso descarga las imágenes y las guarda como archivos `.tar` en `images/`.
2. Copias toda esta carpeta (o el instalador completo) a la máquina destino.
3. En la máquina **sin internet** corres `Cargar-Bundle-Offline.ps1`.
   Eso carga las imágenes en Docker local. Después la instalación normal ya no
   necesita internet para las imágenes.

## Crear el bundle (máquina con internet)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Crear-Bundle-Offline.ps1
```

Genera:

```text
images/postgres-15.tar
images/odoo-17.0.tar
images/manifest.json
```

Para incluir también las imágenes del despliegue VPS (Caddy + base Node del
gateway):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Crear-Bundle-Offline.ps1 -IncludeVps
```

## Cargar el bundle (máquina sin internet)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Cargar-Bundle-Offline.ps1
```

Después de cargar, instala normal:

```powershell
cd ..\..
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dgii-suite.ps1
```

## Qué sigue necesitando internet la primera vez

- Instalar **Docker Desktop** y **Node.js** si la máquina no los tiene (se pueden
  preinstalar manualmente con sus instaladores offline).
- Las dependencias del gateway (`node_modules`) ya vienen incluidas en el paquete,
  así que no requieren `npm install`.

Una vez cargadas las imágenes y con Docker + Node instalados, el sistema funciona
100% offline: Odoo, PostgreSQL y el gateway e-CF corren todo en local.
