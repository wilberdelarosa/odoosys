# Odoo DGII e-CF Stack

Este stack usa una interfaz ERP real en vez de la interfaz demo del gateway.

## Base seleccionada

- ERP/UI: Odoo Community 17.0.
- Localizacion dominicana: `indexa-git/l10n-dominicana`, rama `17.0`.
- Licencia de Odoo Community: LGPL-3.0.
- Licencia de la localizacion dominicana: LGPL-3.0.
- Gateway e-CF: `../ecf-endpoints-service`.

La localizacion dominicana fue creada para la comunidad Odoo Dominicana y actualmente esta mantenida por Indexa. Su modulo principal es `l10n_do_accounting`, que depende de `l10n_do` y `l10n_latam_invoice_document` de Odoo.

## Por que esta base

Odoo ya trae la interfaz madura: contactos, productos, facturas, contabilidad, permisos, reportes, busqueda, filtros y formularios profesionales. Nosotros no tenemos que construir esa UI desde cero.

La pieza dominicana confiable para empezar es `indexa-git/l10n-dominicana`, porque tiene historial, comunidad, licencia abierta y esta hecha especificamente para facturacion fiscal dominicana en Odoo.

## Que hace el conector local

El modulo `l10n_do_ecf_gateway` agrega en facturas electronicas de cliente publicadas un boton:

- `Enviar e-CF DGII`

Ese boton envia la factura e-CF de Odoo al gateway local:

- `POST http://host.docker.internal:3000/api/odoo/invoices`

El gateway responde con:

- e-CF firmado,
- ARECF firmado,
- ACECF firmado,
- TrackId local,
- estado de envio.

El conector envia el e-NCF fiscal generado en Odoo, por ejemplo `E310000000001`, y el gateway lo usa como numero fiscal del XML firmado. Si la factura no es e-CF o no tiene e-NCF, el conector bloquea el envio.

## Levantar Odoo

Primero deja el gateway corriendo:

```bash
cd ../ecf-endpoints-service
npm start
```

Luego levanta Odoo:

```bash
cd ../odoo-dgii-stack
docker compose up -d
```

Abre:

```text
http://localhost:8069
```

Clave maestra de base de datos:

```text
admin
```

## Instalacion dentro de Odoo

1. Crear una base de datos nueva.
2. Activar modo desarrollador.
3. Actualizar lista de aplicaciones.
4. Instalar `Fiscal Accounting (Rep. Dominicana)`.
5. Instalar `Dominican e-CF Gateway Connector`.
6. Crear una factura de cliente con tipo electronico, por ejemplo `E31`.
7. Publicar la factura y verificar que tenga e-NCF.
8. Pulsar `Enviar e-CF DGII`.

Para NCF no electronicos como B01/B02, Odoo los maneja en contabilidad, pero no se envian al gateway e-CF.

## Configuracion del gateway en Odoo

Por defecto el modulo usa:

```text
http://host.docker.internal:3000
```

Si se cambia la URL, crear o modificar este parametro de sistema en Odoo:

```text
l10n_do_ecf_gateway.url
```

## Repos revisados

- `indexa-git/l10n-dominicana`: recomendado para empezar. LGPL-3.0, Odoo 17, mantenido, comunidad dominicana.
- `victors1681/dgii-ecf`: recomendado para la capa tecnica DGII e-CF en Node.js. MIT.
- `manuelpgs/ncf_dgii_reports`: util como referencia historica de reportes NCF, pero orientado a Odoo 10 y movido a otro equipo.
- `tiapa2/l10n_do_ecf`: no recomendado por ahora; el repositorio aparecio vacio al revisarlo.
- `ExpertosTI/odoo18-ncf-module`: no recomendado como base abierta; README indica licencia propietaria.
- `ithesk/odoo_dgii_ecf`: no recomendado por ahora; repo reciente, sin licencia clara.
- `theghostatmachine2/evolux_l10n`: no recomendado como base abierta; orientado a Odoo 19 Enterprise y sin licencia clara al revisar metadata.

## Pendiente para produccion

- Certificado `.p12` real del cliente.
- RNC real y datos fiscales reales.
- Secuencias e-NCF autorizadas.
- HTTPS publico estable para el gateway.
- Validar XML exacto contra los XSD oficiales DGII.
- Pasar certificacion oficial DGII con la empresa.

Ver tambien `../ESTADO_ACTUAL_PRODUCCION_DGII.md` para el estado probado de esta base local.
