# OdooSys

Stack local para ERP Odoo 17 + gateway Node/TypeScript de facturacion electronica DGII.

Este repositorio publica una version curada del proyecto encontrado en `PRUEBA DGI`, lista para compartir sin secretos ni artefactos generados. Incluye:

- `odoo-dgii-stack/`: Odoo Community 17 con PostgreSQL 15 y addons dominicanos/custom.
- `ecf-endpoints-service/`: gateway Node/TypeScript para e-CF, ARECF y ACECF.
- `desktop-app/`: scripts Windows para iniciar el stack como app de escritorio.
- `deploy/`, `dgii_docs/` y documentacion operativa adicional.
- `dgii-ecf-check/`: libreria y utilidades DGII incluidas como material auxiliar.

No se incluyen en este repo:

- `.env` ni certificados reales.
- `node_modules`.
- `windows-native/` y otros runtimes pesados generados localmente.
- archivos temporales, caches y salidas de prueba.

## Arquitectura

1. `ecf-endpoints-service` corre en `http://localhost:3000`.
2. `odoo-dgii-stack` levanta PostgreSQL 15 y Odoo 17 en Docker.
3. El addon `l10n_do_ecf_gateway` envia facturas e-CF desde Odoo al gateway usando `POST /api/odoo/invoices`.
4. `desktop-app` automatiza arranque/parada en Windows si quieres usarlo como app local.

## Requisitos

- Windows 10/11 o Linux/macOS con equivalentes.
- Node.js 20+.
- npm 10+.
- Docker Desktop con Docker Compose.
- Git.

## Instalacion rapida

### 1. Clonar el repositorio

```bash
git clone https://github.com/wilberdelarosa/odoosys
cd odoosys
```

### 2. Configurar el gateway Node

```bash
cd ecf-endpoints-service
cp .env.example .env
npm install
```

En Windows PowerShell puedes usar:

```powershell
Copy-Item .env.example .env
npm install
```

### 3. Levantar Odoo + PostgreSQL

Desde otra terminal:

```bash
cd odoo-dgii-stack
docker compose up -d
```

Servicios esperados:

- Odoo: `http://localhost:8069`
- Gateway: `http://localhost:3000`

### 4. Iniciar el gateway

```bash
cd ecf-endpoints-service
npm start
```

### 5. Probar el sistema

Con el gateway corriendo:

```bash
cd ecf-endpoints-service
npm run test:system
```

## Instalacion asistida en Windows

Tambien puedes usar el instalador raiz:

```powershell
Copy-Item .\install-config.example.json .\install-config.json
powershell -ExecutionPolicy Bypass -File .\install-dgii-suite.ps1
```

Ese script:

- genera `ecf-endpoints-service/.env`,
- instala dependencias del gateway,
- levanta Docker,
- crea/configura la base de datos Odoo,
- instala modulos base, fiscales y de pruebas,
- deja apuntado `l10n_do_ecf_gateway.url` al gateway local.

## Configuracion importante

### Gateway

Archivo: `ecf-endpoints-service/.env`

Variables relevantes:

- `PORT=3000`
- `PUBLIC_BASE_URL=http://localhost:3000`
- `SOFTWARE_NAME`
- `SOFTWARE_VERSION`
- `BUYER_RNC`
- `CERT_PATH`
- `CERT_PASSWORD`
- `GENERATE_DEMO_CERT=true`

Para desarrollo local puedes dejar activo el certificado demo. Para produccion debes usar un `.p12` real y no versionarlo.

### Odoo

Compose: `odoo-dgii-stack/docker-compose.yml`

- PostgreSQL 15 con usuario `odoo` y clave `odoo`.
- Odoo 17 escuchando en el puerto `8069`.
- Addons montados desde:
  - `odoo-dgii-stack/addons/l10n-dominicana`
  - `odoo-dgii-stack/addons/custom`

## Flujo local recomendado

1. Levanta Docker Desktop.
2. Ejecuta `docker compose up -d` en `odoo-dgii-stack`.
3. Ejecuta `npm start` en `ecf-endpoints-service`.
4. Abre Odoo en `http://localhost:8069`.
5. Publica una factura e-CF y usa `Enviar e-CF DGII`.

## Estructura del repositorio

```text
.
├─ desktop-app/
├─ deploy/
├─ dgii_docs/
├─ dgii-ecf-check/
├─ ecf-endpoints-service/
├─ odoo-dgii-stack/
├─ install-config.example.json
├─ install-dgii-suite.ps1
└─ *.md
```

## Notas de publicacion

Este repo fue curado para GitHub. Si quieres reproducir exactamente un entorno local previo, revisa la documentacion operativa incluida en los markdown raiz, pero no subas secretos, certificados ni carpetas generadas.