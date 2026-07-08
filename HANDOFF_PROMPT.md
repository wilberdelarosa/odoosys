# Prompt de Continuidad

Continua este proyecto desde `C:\Users\wilbe\Downloads\PRUEBA DGI` con enfoque de ingenieria riguroso. La meta sigue siendo la misma: reemplazar lo necesario del stack Odoo/DGII por una aplicacion local Node/desktop sin Docker, Odoo ni PostgreSQL cuando sea viable, manteniendo la funcionalidad de facturacion electronica dominicana y verificando todo con pruebas reales.

## Estado actual ya implementado

- El nucleo activo es `ecf-endpoints-service`.
- Ya no depende de Docker/Odoo/Postgres para correr localmente.
- Tiene:
  - e-CF local con secuencias e-NCF.
  - clientes, productos, facturas y cobros.
  - ordenes de venta y conversion a factura.
  - inventario simple con movimientos y bloqueo de stock negativo.
  - asientos contables automaticos para factura y cobro con validacion de partida doble.
  - reporte resumen en `/api/reports/summary`.
  - persistencia JSON con escritura atomica y backup `.bak`.
  - CORS restringido a origen local/configurado.
  - `multer` limitado a 10 MB.
- launcher local en `desktop-node-local` para correr la app sin Docker/Odoo/Postgres.
- empaquetado desktop real en `desktop-electron` con Electron + electron-builder.
- build probado de `win-unpacked`, `portable` y `Setup.exe` NSIS.

## Archivos clave tocados

- `ecf-endpoints-service/src/lib/facturador.ts`
- `ecf-endpoints-service/src/server.ts`
- `ecf-endpoints-service/src/system-test.ts`
- `ecf-endpoints-service/public/index.html`
- `ecf-endpoints-service/public/app.js`
- `ecf-endpoints-service/public/styles.css`
- `ecf-endpoints-service/scripts/verify-local-node.ps1`
- `ecf-endpoints-service/scripts/run-system-test-local.ps1`
- `ecf-endpoints-service/package.json`
- `ecf-endpoints-service/README.md`
- `desktop-node-local/start-dgii-node-desktop.ps1`
- `desktop-node-local/stop-dgii-node-desktop.ps1`
- `desktop-node-local/test-dgii-node-desktop.ps1`
- `desktop-node-local/install-shortcut.ps1`
- `desktop-node-local/README.md`
- `desktop-electron/package.json`
- `desktop-electron/main.mjs`
- `desktop-electron/preload.mjs`
- `desktop-electron/scripts/prepare-service.mjs`
- `desktop-electron/README.md`

## Pruebas que ya pasan

Ejecutar desde `ecf-endpoints-service`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run verify:local-node
npm.cmd run test:system:local
```

Ejecutar desde `desktop-node-local`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-dgii-node-desktop.ps1 -DataRoot "C:\Users\wilbe\Downloads\PRUEBA DGI\.desktop-node-test"
```

Ejecutar desde `desktop-electron`:

```powershell
npm.cmd install
npm.cmd run test:desktop
npm.cmd run dist:dir
npm.cmd run dist:win
```

Resultados verificados antes del handoff:

- `DockerRequired=False`
- `OdooRequired=False`
- `PostgresRequired=False`
- backend Node en torno a `76-83 MB` RSS
- modo Electron embebido en torno a `118-119 MB RSS` del proceso browser y `~121 MB` working set del proceso principal en prueba
- factura emitida y cobrada correctamente
- contabilidad balanceada
- inventario descontado al facturar
- `win-unpacked` probado con `--test-mode`
- instalador NSIS probado con instalacion silenciosa en carpeta local y ejecucion correcta del `.exe` instalado

## Lo que falta realmente

No declares esto como reemplazo completo de Odoo todavia. Faltan piezas operativas importantes:

1. Usuarios, autenticacion y permisos reales para APIs administrativas y operativas.
2. Notas de credito/debito, anulaciones fiscales y flujo de reversos contables.
3. Reportes avanzados fiscales/contables/inventario por periodo.
4. Validaciones mas fuertes de e-NCF externo/importado y reglas DGII por tipo documental.
5. Mejor resiliencia transaccional que JSON plano si esto va a uso intensivo.
6. Empaquetado desktop real tipo Electron/instalador firmado.
7. Correccion de textos con mojibake en la UI.
8. Endpoints destructivos demo como `/api/presets/load` todavia necesitan proteccion o separacion por modo demo.
9. HTTPS publico y certificado real para DGII real; localhost solo cubre pruebas locales.
10. Afinar icono, firma y metadata del instalador Electron para distribucion formal.

## Prioridad recomendada

1. Implementar autenticacion/roles y proteger endpoints sensibles.
2. Agregar notas de credito/debito y reversos contables.
3. Separar claramente modo demo vs modo operativo.
4. Mejorar reportes y exportes.
5. Empaquetar en Electron con storage en `%APPDATA%` y build reproducible.

## Restricciones y criterio

- No reviertas cambios existentes sin motivo.
- Usa `apply_patch` para editar.
- Sigue verificando con comandos reales despues de cada bloque.
- Si introduces empaquetado Electron, no rompas el launcher actual `desktop-node-local`; dejalo como fallback verificable.
- Mantente dentro de patrones ya existentes del proyecto y evita inventar una arquitectura enorme si no resuelve una necesidad real.
