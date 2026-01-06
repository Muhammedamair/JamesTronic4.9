#!/usr/bin/env bash
set -euo pipefail

echo "== JamesTronic Migration Preflight =="

# 1) Must run from repo root
if [[ ! -d "supabase/migrations" ]]; then
  echo "FAIL: supabase/migrations not found. Run from james-tronic repo root."
  exit 1
fi

# 2) Block nested supabase migration traps
if find supabase/migrations -maxdepth 6 -type d -path "*/supabase/migrations/supabase*" | grep -q .; then
  echo "FAIL: Nested migrations folder detected under supabase/migrations/supabase*"
  find supabase/migrations -maxdepth 6 -type d -path "*/supabase/migrations/supabase*" -print
  exit 1
fi

# 3) Block bad filenames that Supabase CLI skips
if ls supabase/migrations 2>/dev/null | grep -Eiq '^applied_'; then
  echo "FAIL: found applied_* migration files. These get skipped and cause drift."
  ls supabase/migrations | grep -Ei '^applied_' || true
  exit 1
fi

if ls supabase/migrations 2>/dev/null | grep -Eq '^README\.md$'; then
  echo "WARN: README.md is skipped by Supabase CLI (not harmful, just informational)."
fi

# 4) Duplicate timestamp detector (must be zero)
dups=$(ls supabase/migrations/*.sql | sed 's/.*\/\([0-9]\{14\}\).*/\1/' | sort | uniq -d || true)
if [[ -n "${dups}" ]]; then
  echo "FAIL: duplicate migration timestamps detected:"
  echo "${dups}"
  exit 1
fi

# 5) Role token hygiene
# Legacy migrations already applied may contain 'manager'/'owner' tokens.
# We FAIL only if those tokens appear in PENDING migrations (versions > latest remote).
latest_remote="$(supabase migration list 2>/dev/null \
  | awk -F'|' '$2 ~ /[0-9]{14}/ {gsub(/[^0-9]/,"",$2); if(length($2)==14) print $2}' \
  | sort | tail -n 1 || true)"

if [[ -z "${latest_remote}" ]]; then
  latest_remote="00000000000000"
  echo "WARN: Could not detect latest remote migration. Treating all migrations as pending."
else
  echo "INFO: latest remote migration version detected: ${latest_remote}"
fi

pending_files=()
for f in supabase/migrations/*.sql; do
  v="$(basename "$f" | cut -c1-14)"
  if [[ "$v" > "$latest_remote" ]]; then
    pending_files+=("$f")
  fi
done

if ((${#pending_files[@]})); then
  if grep -nH -E "('manager'|'owner')" "${pending_files[@]}" >/dev/null 2>&1; then
    echo "FAIL: invalid roles found in PENDING migrations (manager/owner). app_role enum does not include them."
    grep -nH -E "('manager'|'owner')" "${pending_files[@]}" || true
    exit 1
  fi
fi

# If legacy migrations still contain these tokens, warn (do not block)
if grep -RIn --include="*.sql" -E "('manager'|'owner')" supabase/migrations >/dev/null 2>&1; then
  echo "WARN: legacy migrations contain manager/owner role tokens. Already applied in remote; plan a future FP to normalize policies."
fi

# 6) Block punitive RPC grants to client roles in PENDING migrations
if ((${#pending_files[@]})); then
  if grep -nH -E "GRANT[[:space:]]+EXECUTE[[:space:]]+ON[[:space:]]+FUNCTION[[:space:]]+public\.rpc_suspend_actor(_strict)?\b.*TO[[:space:]]+(authenticated|PUBLIC|anon)\b" "${pending_files[@]}" >/dev/null 2>&1; then
    echo "FAIL: PENDING migrations attempt to GRANT EXECUTE on punitive suspend RPCs to client roles."
    grep -nH -E "GRANT[[:space:]]+EXECUTE[[:space:]]+ON[[:space:]]+FUNCTION[[:space:]]+public\.rpc_suspend_actor(_strict)?\b.*TO[[:space:]]+(authenticated|PUBLIC|anon)\b" "${pending_files[@]}" || true
    exit 1
  fi
fi

echo "PASS: Migration hygiene checks OK."
