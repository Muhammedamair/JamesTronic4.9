#!/bin/bash
# scripts/test_concurrency.sh
# Verifies that parallel identical quote requests resolve to a Single Quote ID (idempotency + locking)

set -euo pipefail

# Load Env
if [ -f .env.local ]; then 
  set -a; source .env.local; set +a
fi

TOKEN=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$JT_TEST_MANAGER_EMAIL\",\"password\":\"$JT_TEST_MANAGER_PASSWORD\"}" | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))")

if [ -z "$TOKEN" ]; then echo "Auth failed"; exit 1; fi

CITY_ID="$JT_TEST_CITY_ID"
SERVICE="TV_INSTALL_WALL_32_43"
PARALLELISM=10

echo "--- Concurrency Test ($PARALLELISM requests) ---"

# Temp file for outputs
tmp_dir=$(mktemp -d)
echo "Firing requests..."

pids=""
for i in $(seq 1 $PARALLELISM); do
  curl -s -X POST "$JT_TEST_BASE_URL/api/pricing/quote" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"city_id\":\"$CITY_ID\",\"service_code\":\"$SERVICE\",\"parts_cost\":0,\"urgency\":\"same_day\",\"complexity\":\"complex\"}" \
    > "$tmp_dir/$i.json" &
  pids="$pids $!"
done

wait $pids
echo "All requests completed."

# Extract Quote IDs
echo "Results:"
grep -o '"quote_id":"[^"]*"' "$tmp_dir"/*.json | cut -d'"' -f4 | sort | uniq -c

UNIQUE_COUNT=$(grep -o '"quote_id":"[^"]*"' "$tmp_dir"/*.json | cut -d'"' -f4 | sort | uniq | wc -l)
rm -rf "$tmp_dir"

if [ "$UNIQUE_COUNT" -eq 1 ]; then
  echo "✅ PASS: All requests returned the same Quote ID."
  exit 0
else
  echo "❌ FAIL: Multiple Quote IDs generated ($UNIQUE_COUNT unique IDs)."
  exit 1
fi
