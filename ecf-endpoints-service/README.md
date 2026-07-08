# Facturador e-CF DGII de Prueba

Servicio funcional de prueba para facturacion electronica dominicana. Incluye una interfaz web, APIs de facturacion, generacion de XML e-CF firmado, endpoints emisor-receptor y pruebas de precertificacion local.

Tambien expone las rutas que pide DGII en la postulacion del software:

- `/fe/autenticacion/api/semilla`
- `/fe/autenticacion/api/validacioncertificado`
- `/fe/recepcion/api/ecf`
- `/fe/aprobacioncomercial/api/ecf`

## Que resuelve ahora

- Interfaz web para ver empresa, facturas, datos del software y pruebas.
- Datos base de empresa, clientes y productos.
- Secuencias e-NCF locales administrables por tipo e-CF.
- Creacion de facturas de prueba.
- Emision local de e-CF tipo 31.
- Registro de cobros locales y saldos de cuentas por cobrar.
- Ordenes de venta locales y conversion a factura.
- Inventario local simple con movimientos y control de stock negativo.
- Asientos contables automaticos para factura y cobro, con validacion de partida doble.
- Persistencia local con escritura atomica y backup `.bak`.
- Generacion de XML e-CF firmado.
- Generacion de ARECF firmado.
- Generacion de ACECF firmado.
- Devuelve una semilla XML.
- Valida la semilla firmada y emite un token.
- Recibe un e-CF y responde con un ARECF firmado.
- Recibe una aprobacion comercial y la devuelve como XML firmado o reutiliza la firma existente.
- Expone una ruta de configuracion para copiar los datos al formulario DGII.
- Ejecuta pruebas de preparacion local desde la UI y desde `npm run test:system`.
- Recibe facturas e-CF desde Odoo en `POST /api/odoo/invoices` y usa el e-NCF fiscal enviado por Odoo.

## Uso

1. Instalar dependencias con `npm install`.
2. Copiar `.env.example` a `.env` y ajustar valores.
3. Iniciar con `npm start`.
4. Abrir `http://localhost:3000/` para ver la interfaz.
5. Abrir `http://localhost:3000/software-config` para ver los datos del formulario DGII.

Para un build de produccion local:

```bash
npm run build
npm run start:prod
```

La imagen Docker usa este build compilado para reducir dependencias de desarrollo dentro del contenedor.

## Verificacion local sin Docker/Odoo

Para validar el nucleo Node de facturacion e-CF como proceso local aislado:

```powershell
npm run verify:local-node
```

La verificacion levanta `dist/server.js` en `127.0.0.1:3300`, usa almacenamiento temporal local, crea una secuencia fiscal `E32`, crea una factura, emite e-CF desde esa secuencia, registra un cobro local, valida firma XML, corre pruebas de precertificacion y reporta memoria del proceso. Esta prueba no arranca Docker, Odoo, Python ni PostgreSQL.

Estado actual de migracion: este servicio Node ya cubre la capa e-CF local, CRUD basico de clientes/productos/facturas, secuencias fiscales e-NCF, cobros simples, ordenes de venta, inventario simple, asientos contables basicos, backups locales y una UI/laboratorio de facturacion de prueba. El reemplazo completo de Odoo todavia requiere reportes avanzados, usuarios/permisos, notas de credito/debito completas, anulaciones fiscales y empaquetado Electron/instalador firmado si se quiere distribuir como app nativa.

## Pruebas

Con el servidor corriendo:

```bash
npm run test:system
```

La prueba valida:

- salud del servicio,
- dashboard,
- cliente demo,
- producto demo,
- creacion de factura,
- orden de venta,
- consumo de inventario,
- emision e-CF,
- registro de cobro local,
- asiento contable balanceado,
- firma XML,
- ARECF con estado recibido,
- pruebas de precertificacion local.

## Rutas principales

- UI: `http://localhost:3000/`
- Configuracion DGII: `http://localhost:3000/software-config`
- Dashboard API: `http://localhost:3000/api/dashboard`
- Secuencias e-NCF: `http://localhost:3000/api/fiscal-sequences`
- Cobros: `GET http://localhost:3000/api/payments` y `POST http://localhost:3000/api/invoices/:id/payments`
- Inventario: `GET http://localhost:3000/api/inventory` y `POST http://localhost:3000/api/inventory/movements`
- Ordenes de venta: `GET/POST http://localhost:3000/api/sale-orders`
- Contabilidad: `GET http://localhost:3000/api/accounting/summary`
- Reportes: `GET http://localhost:3000/api/reports/summary`
- Pruebas: `POST http://localhost:3000/api/precertification/run`
- Odoo e-CF: `POST http://localhost:3000/api/odoo/invoices`
- Semilla: `GET http://localhost:3000/fe/autenticacion/api/semilla`
- Validacion certificado: `POST http://localhost:3000/fe/autenticacion/api/validacioncertificado`
- Recepcion: `POST http://localhost:3000/fe/recepcion/api/ecf`
- Aprobacion comercial: `POST http://localhost:3000/fe/aprobacioncomercial/api/ecf`

## Para empresa real

Para pasar de demo local a empresa real se debe configurar:

1. RNC real de la empresa.
2. Datos fiscales reales.
3. Certificado digital `.p12` real y clave.
4. URL HTTPS publica y estable.
5. Secuencias e-NCF autorizadas y configuradas correctamente.
6. Validacion contra ambiente DGII correspondiente.
7. Proceso oficial de certificacion DGII aprobado por la empresa.

## Importante

- Para pruebas locales puede autogenerar un `.p12` demo.
- Para certificacion real debes reemplazarlo por el certificado digital real del cliente y publicar el servicio en una URL HTTPS publica y estable.
- Las pruebas locales no sustituyen la aprobacion oficial de DGII.
- El endpoint de Odoo exige que la factura incluya `fiscalNumber` con formato e-NCF, por ejemplo `E310000000001`.

## Launcher local desktop

Para correr el nucleo Node como aplicacion local ligera:

```powershell
cd "..\desktop-node-local"
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-dgii-node-desktop.ps1
```

La verificacion del launcher se ejecuta con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-dgii-node-desktop.ps1
```
