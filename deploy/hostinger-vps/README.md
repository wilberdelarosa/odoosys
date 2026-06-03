# Piloto Odoo DGII en Hostinger VPS

Este paquete es para Hostinger VPS o cualquier VPS Linux con Docker. No es para hosting compartido, porque Odoo necesita procesos persistentes, PostgreSQL y contenedores.

## Arquitectura del piloto

- `https://erp.tudominio.com`: Odoo Community 17.
- `https://dgii.tudominio.com`: gateway e-CF con endpoints para DGII.
- PostgreSQL 15 persistente.
- Caddy con HTTPS automatico.

## Campos DGII de la captura

En el formulario de DGII usa:

- Tipo de software: `PROPIO`
- Nombre del software: valor de `SOFTWARE_NAME`
- Version del software: valor de `SOFTWARE_VERSION`
- URL de recepcion: dominio `dgii.tudominio.com` + `/fe/recepcion/api/ecf`
- URL de aprobacion comercial: dominio `dgii.tudominio.com` + `/fe/aprobacioncomercial/api/ecf`
- URL de autenticacion: dominio `dgii.tudominio.com` + `/fe/autenticacion/api/[semilla|validacioncertificado]`

Tambien puedes verificarlo en:

```text
https://dgii.tudominio.com/software-config
```

## Preparacion DNS

Crea dos registros DNS tipo `A` apuntando a la IP del VPS:

```text
erp.tudominio.com  -> IP_DEL_VPS
dgii.tudominio.com -> IP_DEL_VPS
```

## Instalacion en el VPS

1. Instala Docker y Docker Compose.
2. Sube este proyecto completo al VPS.
3. Entra a este directorio:

```bash
cd deploy/hostinger-vps
```

1. Copia los archivos de ejemplo:

```bash
cp .env.example .env
cp gateway.env.example gateway.env
cp pilot.env.example pilot.env
```

1. Edita `.env`, `gateway.env` y `pilot.env` con los dominios, correo, RNC, empresa y nombre real del software.
1. Provisiona Odoo e instala los modulos:

```bash
chmod +x provision-odoo.sh
./provision-odoo.sh
```

1. Si solo quieres levantar servicios ya provisionados:

```bash
docker compose up -d --build
```

1. Revisa el gateway:

```bash
curl https://dgii.tudominio.com/health
curl https://dgii.tudominio.com/software-config
```

1. En Odoo, el conector debe apuntar a:

```text
http://gateway:3000
```

Eso se guarda en el parametro de sistema:

```text
l10n_do_ecf_gateway.url
```

## Certificado digital real

Para demo se puede usar `GENERATE_DEMO_CERT=true`, pero para postulacion/certificacion real debes usar el `.p12` real del contribuyente.

En ese caso:

```text
GENERATE_DEMO_CERT=false
CERT_PATH=/app/storage/certificados/certificado.p12
CERT_PASSWORD=clave-real
```

Luego coloca el archivo `.p12` dentro del volumen `gateway-storage`, o ajusta el compose para montar una carpeta segura del VPS.

## Recomendacion comercial

Para el piloto de tu hermana, usa un VPS pequeno y separa:

- Odoo para gestion operativa.
- Gateway para endpoints DGII.
- Dominio propio con HTTPS.
- Backups diarios de PostgreSQL y del volumen del gateway.

Cuando el piloto funcione con una empresa real, puedes convertir esta misma base en tu plantilla de instalacion para otros clientes.
