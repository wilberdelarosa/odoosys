# e-CF Test Lab DO

Laboratorio automatico para probar el flujo e-CF desde Odoo antes de emitir en real.

## Que prueba

Desde Odoo ejecuta una corrida automatica contra el gateway Node `ecf-endpoints-service`:

1. `GET /health` - confirma que el gateway esta vivo.
2. `GET /software-config` - confirma URLs que se usan en el formulario DGII.
3. `GET /api/certificate/status` - confirma si el gateway cargo certificado `.p12`.
4. `GET /api/testlab/required-files` - muestra archivos concretos requeridos.
5. `POST /api/precertification/run` - ejecuta firma de semilla, token local, XML e-CF firmado, ARECF y ACECF.
6. `POST /api/odoo/invoices` - genera una factura dry-run desde payload Odoo y devuelve XML firmado.

## Archivo que debes buscar

Para pruebas reales de DGII necesitas:

1. Certificado digital tributario `.p12` del contribuyente o firmante autorizado.
2. Clave privada del `.p12`.
3. URL HTTPS publica del gateway.

No envies el `.p12` ni la clave por chat. No los subas al repositorio.

## Donde se configura

En el gateway Node, usando variables de entorno:

```env
GENERATE_DEMO_CERT=false
CERT_PATH=/app/storage/certificados/certificado.p12
CERT_PASSWORD=clave-del-p12
PUBLIC_BASE_URL=https://dgii.tudominio.com
```

Para pruebas locales sin certificado real:

```env
GENERATE_DEMO_CERT=true
DEMO_CERT_PASSWORD=demo123
PUBLIC_BASE_URL=http://localhost:3000
```

## Orden recomendado

1. Ejecutar con certificado demo local.
2. Confirmar que la prueba completa pasa en Odoo.
3. Copiar el `.p12` real al servidor seguro del gateway.
4. Cambiar `GENERATE_DEMO_CERT=false`, `CERT_PATH` y `CERT_PASSWORD`.
5. Reiniciar el gateway.
6. Ejecutar nuevamente el laboratorio desde Odoo.
7. Probar en `TesteCF`.
8. Probar en `CerteCF`.
9. Solo despues pasar a `eCF` produccion.

## Importante

Este laboratorio no reemplaza la certificacion oficial DGII. Su objetivo es reducir errores antes de entrar a TesteCF/CerteCF/eCF.
