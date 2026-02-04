#!/bin/bash
# scripts/test_guardrails.sh
# Verifies that quotes exceeding max_total are BLOCKED

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

# Use a service with a known max_total (from default ruleset: TV_INSTALL_WALL_32_43 max 1200)
# We add high parts cost to exceed it
CITY_ID="$JT_TEST_CITY_ID"
SERVICE="TV_INSTALL_WALL_32_43"

echo "--- Guardrail Test (Trying to breach max_total) ---"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$JT_TEST_BASE_URL/api/pricing/quote" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"city_id\":\"$CITY_ID\",\"service_code\":\"$SERVICE\",\"parts_cost\":5000,\"urgency\":\"standard\",\"complexity\":\"standard\"}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "GUARDRAIL_MAX_EXCEEDED"; then
  echo "✅ PASS: Quote was correctly blocked by guardrail."
  exit 0
else
  echo "❌ FAIL: Quote was NOT blocked."
  exit 1
fi
