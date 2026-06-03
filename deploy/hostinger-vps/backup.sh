#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Falta .env"
  exit 1
fi

set -a
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/$STAMP"

echo "==> Backup PostgreSQL"
docker compose exec -T db pg_dumpall -U "${ODOO_DB_USER:-odoo}" > "$BACKUP_DIR/$STAMP/postgres-all.sql"

echo "==> Backup filestore Odoo"
docker run --rm -v "$(basename "$PWD")_odoo-web-data:/data:ro" -v "$BACKUP_DIR/$STAMP:/backup" alpine tar czf /backup/odoo-web-data.tar.gz -C /data .

echo "==> Backup XML/certificados gateway"
docker run --rm -v "$(basename "$PWD")_gateway-storage:/data:ro" -v "$BACKUP_DIR/$STAMP:/backup" alpine tar czf /backup/gateway-storage.tar.gz -C /data .

echo "Backup listo: $BACKUP_DIR/$STAMP"
