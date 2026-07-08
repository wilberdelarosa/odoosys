# ERP DGII Windows Native

Esta carpeta prepara una version local sin Docker para Windows. Es una ruta empresarial mas compleja que la actual, porque reemplaza el contenedor `odoo:17.0` por:

- Odoo 17 descargado desde GitHub.
- Entorno virtual Python local.
- PostgreSQL instalado como servicio Windows.
- Gateway Node corriendo local.
- Supervisores PowerShell para mantener Odoo y gateway vivos.
- Accesos directos de escritorio.

## Estado real ahora

Bootstrap nativo validado parcialmente en esta maquina:

- Python 3.11 instalado y detectado.
- Odoo 17 descargado desde ZIP oficial y extraido en `runtime\odoo-17-native`.
- Entorno virtual creado en `runtime\odoo-venv`.
- Dependencias Python de Odoo instaladas; `odoo-bin --version` responde `Odoo Server 17.0`.
- Config Odoo creada en `runtime\odoo-native.conf` con addons custom y l10n Dominicana.

Pendiente para cerrar la version sin Docker end-to-end:

- PostgreSQL no esta instalado en esta sesion (`psql` no existe y no hay servicio `postgresql*`).
- La sesion actual no esta elevada (`IS_ADMIN=False`), por lo que no puede instalar el servicio Windows de PostgreSQL.
- Despues de instalar PostgreSQL en PowerShell administrador, falta inicializar DB, instalar modulos Odoo y probar login/gateway en runtime nativo.

## Instalacion recomendada en maquina de prueba

1. Copia la configuracion:

```powershell
Copy-Item .\native-config.example.json .\native-config.json
```

1. Instala prerequisitos y prepara runtime.

Para instalar PostgreSQL como servicio, abre PowerShell como administrador:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InstallPrerequisites
```

Si no tienes `winget`, el instalador usa descargas directas configuradas en `native-config.json`.

Tambien puedes separar los pasos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InstallPython
```

Y luego, en PowerShell como administrador:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InstallPostgres
```

En esta maquina el comando pendiente minimo es:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InstallPostgres
```

Despues de que PostgreSQL exista como servicio, vuelve a esta carpeta y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -SkipOdooClone -SkipNpmInstall -InitializeDatabase -InstallOdooModules
```

1. Si ya tienes PostgreSQL instalado y configurado, prepara Odoo/gateway sin winget:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1
```

1. Para instalar modulos despues de tener PostgreSQL operativo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InitializeDatabase -InstallOdooModules
```

1. Crea accesos directos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcuts-native.ps1 -StartAtLogin
```

1. Inicia:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-native.ps1
```

## Pruebas

Prueba estatica:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-native.ps1 -StaticOnly
```

Estado esperado antes de PostgreSQL: debe fallar solo en `PostgreSQL psql` y `PostgreSQL service`. `Odoo source`, `Odoo venv`, `Odoo config` y `Odoo runtime deps` deben estar en `True`.

Prueba con servicios corriendo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-native.ps1
```

## Checklist antes de vender

- `test-native.ps1 -StaticOnly` debe pasar completo.
- `install-native.ps1 -InitializeDatabase -InstallOdooModules` debe instalar todos los modulos sin error.
- `start-native.ps1` debe abrir Odoo en `http://localhost:8069/web/login`.
- `http://localhost:3000/health` debe responder OK.
- En Odoo deben cargar Operaciones, escaner de inventario y Laboratorio e-CF.
- Una prueba e-CF demo debe generar XML firmado sin usar certificado real.
- El acceso directo debe abrir la app despues de reiniciar Windows.
- `stop-native.ps1` debe detener gateway y Odoo sin procesos colgados.

## Limitaciones importantes

- Odoo en Windows nativo depende de que las librerias Python compilen o tengan wheels compatibles.
- PostgreSQL debe quedar instalado como servicio Windows.
- Para DGII real necesitas endpoints HTTPS publicos; local sirve para demo/pruebas, pero certificacion/produccion normalmente requiere VPS o servidor publico.
- Esta ruta es viable, pero requiere pruebas en una maquina limpia antes de empaquetarla comercialmente.
