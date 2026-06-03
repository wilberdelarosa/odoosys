#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Falta .env. Copia .env.example a .env y ajusta los valores."
  exit 1
fi

if [ ! -f pilot.env ]; then
  echo "Falta pilot.env. Copia pilot.env.example a pilot.env y ajusta los valores."
  exit 1
fi

set -a
source .env
source pilot.env
set +a

: "${ODOO_DATABASE:?Falta ODOO_DATABASE}"
: "${ADMIN_LOGIN:?Falta ADMIN_LOGIN}"
: "${ADMIN_PASSWORD:?Falta ADMIN_PASSWORD}"
: "${COMPANY_NAME:?Falta COMPANY_NAME}"
: "${COMPANY_VAT:?Falta COMPANY_VAT}"
: "${COMPANY_STREET:?Falta COMPANY_STREET}"
: "${COMPANY_CITY:?Falta COMPANY_CITY}"
: "${ODOO_DB_USER:?Falta ODOO_DB_USER}"
: "${ODOO_DB_PASSWORD:?Falta ODOO_DB_PASSWORD}"

BASE_MODULES="base,stock,sale_management,purchase,account,point_of_sale,delivery,website_sale,stock_scan_do"
FISCAL_MODULES="l10n_do_accounting,l10n_do_ecf_gateway"

echo "==> Levantando servicios"
docker compose up -d db

echo "==> Recreando base $ODOO_DATABASE"
docker compose exec -T db psql -U "$ODOO_DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $ODOO_DATABASE WITH (FORCE);"
docker compose exec -T db psql -U "$ODOO_DB_USER" -d postgres -c "CREATE DATABASE $ODOO_DATABASE OWNER $ODOO_DB_USER;"

echo "==> Instalando modulos base"
docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf \
  --db_host=db \
  --db_user="$ODOO_DB_USER" \
  --db_password="$ODOO_DB_PASSWORD" \
  -d "$ODOO_DATABASE" \
  -i "$BASE_MODULES" \
  --without-demo=all \
  --stop-after-init

echo "==> Configurando empresa y administrador"
docker compose run --rm -T odoo odoo shell -c /etc/odoo/odoo.conf \
  --db_host=db \
  --db_user="$ODOO_DB_USER" \
  --db_password="$ODOO_DB_PASSWORD" \
  -d "$ODOO_DATABASE" <<PY
company = env.company
admin = env.ref('base.user_admin')
country_do = env.ref('base.do')
admin.write({
    'login': '$ADMIN_LOGIN',
    'password': '$ADMIN_PASSWORD',
})
admin.partner_id.write({
    'name': '$COMPANY_NAME',
    'email': '$ADMIN_LOGIN',
})
company.write({
    'name': '$COMPANY_NAME',
    'vat': '$COMPANY_VAT',
    'street': '$COMPANY_STREET',
    'city': '$COMPANY_CITY',
    'country_id': country_do.id,
})
env.cr.commit()
print('database', '$ODOO_DATABASE')
print('admin_login', '$ADMIN_LOGIN')
PY

echo "==> Instalando modulos fiscales dominicanos"
docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf \
  --db_host=db \
  --db_user="$ODOO_DB_USER" \
  --db_password="$ODOO_DB_PASSWORD" \
  -d "$ODOO_DATABASE" \
  -i "$FISCAL_MODULES" \
  --without-demo=all \
  --stop-after-init

echo "==> Aplicando configuracion fiscal final"
docker compose run --rm -T odoo odoo shell -c /etc/odoo/odoo.conf \
  --db_host=db \
  --db_user="$ODOO_DB_USER" \
  --db_password="$ODOO_DB_PASSWORD" \
  -d "$ODOO_DATABASE" <<PY
company = env.company
if not company.chart_template:
    env['account.chart.template'].try_loading('do', company, install_demo=False)
journals = env['account.journal'].search([
    ('type', 'in', ('sale', 'purchase')),
    ('company_id', '=', company.id),
])
journals.write({'l10n_latam_use_documents': True})
env['ir.config_parameter'].sudo().set_param('l10n_do_ecf_gateway.url', '$ODOO_GATEWAY_URL')
env.cr.commit()
print('gateway_url', '$ODOO_GATEWAY_URL')
PY

echo "==> Levantando plataforma completa"
docker compose up -d --build

echo "Instalacion completada."
echo "Odoo: https://${ODOO_DOMAIN}"
echo "Gateway: https://${GATEWAY_DOMAIN}"
echo "Base: ${ODOO_DATABASE}"
echo "Admin: ${ADMIN_LOGIN}"