#!/usr/bin/env bash
# Creates a migration from the diff between the dev database and schema.prisma,
# without the interactive `prisma migrate dev` (which can hang in CI/containers).
# Usage: scripts/new-migration.sh <name>
set -euo pipefail
name="${1:?migration name required}"
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_${name}"
sql="$(npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script)"
if echo "$sql" | grep -q "empty migration"; then echo "No schema changes."; exit 0; fi
mkdir -p "$dir"
echo "$sql" > "$dir/migration.sql"
echo "Created $dir/migration.sql — review it, then run: npx prisma migrate deploy && npx prisma generate"
