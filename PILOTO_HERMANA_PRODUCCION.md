# Piloto para empresa remota

## Decision recomendada

Para el piloto de tu hermana conviene usar Hostinger VPS, no hosting compartido.

Hosting compartido sirve para paginas PHP/HTML, pero esta solucion necesita:

- Odoo corriendo 24/7,
- PostgreSQL persistente,
- gateway Node.js persistente,
- HTTPS real,
- backups,
- posibilidad de instalar Docker.

Si el plan de Hostinger que tienes es VPS, se puede subir. Si es hosting compartido, no es el lugar correcto para correr Odoo; se podria usar solo para una pagina informativa o portal externo.

## Lo que ya queda preparado

- Odoo Community 17 con ventas, compras, inventario, POS, eCommerce y delivery.
- Localizacion dominicana.
- Conector e-CF hacia el gateway.
- Modulo `stock_scan_do` para escaneo de inventario en Community.
- Notificaciones visuales de escaneo.
- Gateway e-CF con endpoints requeridos por el formulario DGII.
- Dockerfile del gateway.
- Paquete `deploy/hostinger-vps` con Caddy y HTTPS automatico.
- Script Linux `deploy/hostinger-vps/provision-odoo.sh` para provisionar la base piloto en VPS.
- Script Windows `install-dgii-suite.ps1` para instalar localmente o en una maquina Windows con Docker.

## Datos que necesitamos de ella

Antes de subirlo a produccion piloto, pide estos datos:

- nombre legal de la empresa,
- RNC o cedula fiscal,
- direccion fiscal,
- correo administrador,
- telefono,
- dominio o subdominio disponible,
- certificado digital `.p12`,
- clave del certificado `.p12`,
- secuencias e-NCF autorizadas o estado del proceso DGII,
- logo de la empresa,
- moneda y lista de productos iniciales,
- usuarios que van a entrar,
- si usara POS o solo facturas desde Odoo.

## Subdominios recomendados

Usa dos subdominios:

```text
erp.sudominio.com
dgii.sudominio.com
```

En DNS ambos deben apuntar a la IP del VPS.

## Campos de la captura DGII

Cuando el gateway este publicado, abre:

```text
https://dgii.sudominio.com/software-config
```

Ese endpoint devuelve los datos para copiar en el formulario.

Los campos quedan asi:

```text
Tipo de software: PROPIO
Nombre del software: el valor de SOFTWARE_NAME
Version del software: el valor de SOFTWARE_VERSION
URL de recepcion: https://dgii.sudominio.com/fe/recepcion/api/ecf
URL de aprobacion comercial: https://dgii.sudominio.com/fe/aprobacioncomercial/api/ecf
URL de autenticacion: https://dgii.sudominio.com/fe/autenticacion/api/[semilla|validacioncertificado]
```

Tambien quedan disponibles las URLs reales:

```text
https://dgii.sudominio.com/fe/autenticacion/api/semilla
https://dgii.sudominio.com/fe/autenticacion/api/validacioncertificado
https://dgii.sudominio.com/fe/autenticacion/api/validarsemilla
```

## Archivos que se deben editar para el piloto

En el VPS:

```bash
cd deploy/hostinger-vps
cp .env.example .env
cp gateway.env.example gateway.env
cp pilot.env.example pilot.env
```

Edita `.env`:

```text
ODOO_DOMAIN=erp.sudominio.com
GATEWAY_DOMAIN=dgii.sudominio.com
TLS_EMAIL=correo@empresa.com
POSTGRES_PASSWORD=clave-larga
ODOO_DB_USER=odoo
ODOO_DB_PASSWORD=clave-larga-odoo
ODOO_MASTER_PASSWORD=clave-maestra-odoo
```

Edita `gateway.env`:

```text
PUBLIC_BASE_URL=https://dgii.sudominio.com
SOFTWARE_NAME=Nombre Comercial del Software
SOFTWARE_VERSION=1.0.0
BUYER_RNC=RNC_DE_LA_EMPRESA
GENERATE_DEMO_CERT=false
CERT_PATH=/app/storage/certificados/certificado.p12
CERT_PASSWORD=clave-del-p12
```

Edita `pilot.env`:

```text
ODOO_DATABASE=piloto_hermana
ADMIN_LOGIN=correo@empresa.com
ADMIN_PASSWORD=clave-admin
COMPANY_NAME=Nombre Legal Empresa
COMPANY_VAT=RNC_DE_LA_EMPRESA
COMPANY_STREET=Direccion fiscal
COMPANY_CITY=Ciudad
ODOO_GATEWAY_URL=http://gateway:3000
```

## Instalacion en el VPS

Desde `deploy/hostinger-vps`:

```bash
chmod +x provision-odoo.sh
./provision-odoo.sh
```

Luego verifica:

```bash
curl https://dgii.sudominio.com/health
curl https://dgii.sudominio.com/software-config
```

## Estado de produccion

Esto queda como piloto utilizable y modificable, pero no debe venderse como produccion fiscal final hasta cerrar:

- certificado `.p12` real instalado,
- HTTPS activo,
- endpoints visibles desde internet,
- secuencias e-NCF reales,
- validacion/certificacion DGII aprobada,
- backups diarios,
- usuario administrador cambiado,
- pruebas de facturacion reales desde Odoo,
- impresion final de factura o ticket segun negocio.

## Recomendacion para este piloto

Primero sube una version con certificado demo para validar acceso, Odoo, login, inventario y facturacion interna.

Despues cambia a certificado real y datos reales para DGII.

No subas el `.p12` a repositorios ni lo envies por canales inseguros. Debe ir solo al servidor final y con acceso restringido.
