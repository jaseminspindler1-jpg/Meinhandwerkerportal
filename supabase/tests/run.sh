#!/usr/bin/env bash
# Testet supabase/schema.sql gegen eine frische lokale Postgres-Datenbank.
# Voraussetzung: laufender Postgres-Server, Zugang über die üblichen PG*-Umgebungsvariablen.
set -euo pipefail
cd "$(dirname "$0")"
DB=mhp_test_$$
createdb "$DB"
trap 'dropdb "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -c 'set client_min_messages = warning' -f supabase_stub.sql -f ../schema.sql
psql -d "$DB" -f rls_test.sql 2>&1 | grep -E '^T[0-9]+|ERROR' | sed 's/^psql:[^ ]* /   /'
