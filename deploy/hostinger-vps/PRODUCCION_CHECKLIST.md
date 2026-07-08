# Checklist de produccion piloto Hostinger VPS

## Antes de levantar

- Confirmar que el plan es Hostinger VPS, no hosting compartido.
- Crear DNS tipo A: `erp.tudominio.com` y `dgii.tudominio.com` apuntando a la IP del VPS.
- Copiar `.env.example` a `.env`, `gateway.env.example` a `gateway.env` y `pilot.env.example` a `pilot.env`.
- Generar hashes nuevos si cambias el usuario/clave del panel gateway. En `.env`, guarda el hash entre comillas simples para que Docker Compose no interprete los `$`:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'TU_CLAVE'
```

- Colocar el certificado real como `deploy/hostinger-vps/certificados/certificado.p12`.
- En `gateway.env`, dejar `GENERATE_DEMO_CERT=false`, `CERT_PATH=/app/storage/certificados/certificado.p12` y `CERT_PASSWORD` real.

## Usuario inicial sugerido

- Odoo: usar `ADMIN_LOGIN` y `ADMIN_PASSWORD` de `pilot.env`.
- Panel gateway: usar `GATEWAY_ADMIN_USER` de `.env` y la clave que corresponde al hash `GATEWAY_ADMIN_PASSWORD_HASH`.

## Verificacion tecnica

```bash
docker compose up -d --build
docker compose ps
curl https://dgii.tudominio.com/health
curl https://dgii.tudominio.com/software-config
curl https://dgii.tudominio.com/fe/autenticacion/api/semilla
```

El panel `https://dgii.tudominio.com/` debe pedir usuario y clave. Las rutas `/fe/*`, `/health` y `/software-config` quedan publicas para DGII.

## Verificacion Odoo

- Entrar a `https://erp.tudominio.com`.
- Confirmar empresa, RNC, direccion, correo, telefono y moneda.
- Crear cliente con RNC valido.
- Crear producto o servicio.
- Crear cotizacion, confirmar venta y generar factura.
- Publicar factura e-CF y pulsar `Enviar e-CF DGII`.
- Confirmar TrackId y XML firmado en el gateway.
- Imprimir PDF desde Odoo y verificar datos fiscales/QR segun el formato final requerido.

## Backups

Ejecutar backup manual:

```bash
chmod +x backup.sh
./backup.sh
```

Programar cron diario:

```bash
0 2 * * * cd /ruta/PRUEBA-DGI/deploy/hostinger-vps && ./backup.sh >> backups/backup.log 2>&1
```

## Bloqueos fiscales

- La DGII solo autoriza emision real si el contribuyente esta habilitado.
- El certificado `.p12` debe corresponder al contribuyente/representante correcto.
- Deben cargarse secuencias e-NCF reales autorizadas.
- El XML final debe validarse contra XSD oficiales DGII antes de facturar en produccion.
