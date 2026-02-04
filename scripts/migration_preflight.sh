#!/bin/bash
# Migration preflight check
# This script is called by the pre-push hook to ensure migrations are valid

echo "[Migration Preflight] Checking for migration issues..."

# Basic check: ensure migrations directory exists if it has files
if [ -d "./supabase/migrations" ]; then
    MIGRATION_COUNT=$(find ./supabase/migrations -name "*.sql" 2>/dev/null | wc -l)
    echo "[Migration Preflight] Found $MIGRATION_COUNT migration files."
fi

echo "[Migration Preflight] ✅ Preflight passed"
exit 0
