# ERP DGII Desktop

Capa Windows para usar el stack local como app de escritorio.

## Que instala

- Acceso directo `ERP DGII Desktop` en el escritorio.
- Acceso directo `Detener ERP DGII` en el escritorio.
- Autoarranque al iniciar sesion.
- Apertura de Odoo en modo app con Edge o Chrome.
- Supervisor del gateway Node con reinicio automatico.

## Scripts

- `install-erp-desktop.ps1`: crea accesos directos y autoarranque.
- `start-erp-desktop.ps1`: inicia Docker Desktop si hace falta, levanta Odoo, arranca el gateway y abre la app.
- `stop-erp-desktop.ps1`: detiene el supervisor del gateway y el stack Docker.
- `run-gateway-supervised.ps1`: mantiene vivo el gateway local.

## Modo remoto sin Docker local

Si Odoo y el gateway viven en un VPS, crea este archivo junto a los scripts:

```text
desktop-app.config.json
```

Usa como base `desktop-app.config.example.json` y coloca algo asi:

```json
{
  "mode": "remote",
  "odooUrl": "https://erp.tudominio.com/web/login",
  "gatewayHealthUrl": "https://dgii.tudominio.com/health"
}
```

Con `mode: remote`, el launcher ya no exige Docker local. Solo abre la app de escritorio apuntando al servidor remoto.

## Logs

Los logs quedan en:

```text
%LOCALAPPDATA%\DGII-ERP-Desktop\logs
```

## Nota

El acceso de escritorio funciona con el certificado demo actual. Cuando tengas el `.p12` real, solo cambia la configuracion del gateway y el lanzador seguira funcionando igual.
