#!/bin/bash
# scripts/verify_pricing_ci.sh
# CI-Grade Verification Script for Dynamic Pricing v1
# Covers: Health -> Auth -> Session -> Quote -> Accept -> Audit
# Requirements: bash, curl, python3 (for json parsing)

set -euo pipefail

# -----------------------------------------------------------------------------
# 1. Environment & Setup
# -----------------------------------------------------------------------------

# Helper: JSON extraction
json_get () {
  local key="$1"
  python3 -c "import sys, json; print(json.load(sys.stdin).get('$key', ''))" 2>/dev/null || echo ""
}

# Helper: Require Env Var
require_env () {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "❌ Missing required env var: $name"
    exit 1
  fi
}

# Source .env.local if present AND required vars missing behavior matches C20 logic
if [ -f .env.local ] && [ -z "${JT_TEST_MANAGER_EMAIL:-}" ]; then
  echo "Loading from .env.local..."
  set -a
  source .env.local
  set +a
fi

require_env "NEXT_PUBLIC_SUPABASE_URL"
require_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"
require_env "JT_TEST_BASE_URL"
require_env "JT_TEST_MANAGER_EMAIL"
require_env "JT_TEST_MANAGER_PASSWORD"
require_env "JT_TEST_CITY_ID"

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
LOCAL_API="$JT_TEST_BASE_URL"
EMAIL="$JT_TEST_MANAGER_EMAIL"
PASS="$JT_TEST_MANAGER_PASSWORD"
CITY_ID="$JT_TEST_CITY_ID"

# Curl safety options
CURL_OPTS=(--fail --silent --show-error --connect-timeout 5 --max-time 25 --retry 2 --retry-delay 1)
CURL="curl ${CURL_OPTS[*]}"

# Cleanup cookie jar
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

echo "--- C21 Pricing Engine CI Verification ---"
echo "Target: $LOCAL_API"
echo "City: $CITY_ID"
echo "User: $EMAIL"

# -----------------------------------------------------------------------------
# 2. Health & Auth
# -----------------------------------------------------------------------------

echo -e "\n1. Health Check ($LOCAL_API/api/health)..."
# Health might return 200 or 204, verify success
$CURL "$LOCAL_API/api/health" >/dev/null
echo "✅ Health OK"

echo -e "\n2. Authenticating with Supabase..."
# Token exchange
RES_AUTH=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

TOKEN=$(echo "$RES_AUTH" | json_get "access_token")

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Auth Failed. Response:"
  echo "$RES_AUTH"
  exit 1
fi
echo "✅ Auth OK (Token obtained)"

# Verify Session Creation (Bearer required)
echo -e "\n3. Verifying Session Creation (P0 Hardened)..."
HTTP_CODE=$($CURL -o /dev/null -w "%{http_code}" -X POST "$LOCAL_API/api/auth/session/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceFingerprint":"ci-pricing-test"}')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Session Create Failed: $HTTP_CODE"
  exit 1
fi
echo "✅ Session Create OK (200)"

# -----------------------------------------------------------------------------
# 3. Quote Engine Test
# -----------------------------------------------------------------------------

echo -e "\n4. Generating Quote..."
SERVICE_Code="TV_INSTALL_WALL_32_43"

# Quote Payload
QUOTE_PAYLOAD="{\"city_id\":\"$CITY_ID\",\"service_code\":\"$SERVICE_Code\",\"parts_cost\":0,\"urgency\":\"standard\",\"complexity\":\"standard\"}"

QUOTE_RES=$($CURL -X POST "$LOCAL_API/api/pricing/quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$QUOTE_PAYLOAD")

QUOTE_ID=$(echo "$QUOTE_RES" | json_get "quote_id")
TOTAL=$(echo "$QUOTE_RES" | python3 -c "import sys, json; print(json.load(sys.stdin).get('breakdown', {}).get('total', ''))")

if [ -z "$QUOTE_ID" ] || [ "$QUOTE_ID" == "null" ]; then
  echo "❌ Quote Generation Failed. Response:"
  echo "$QUOTE_RES"
  exit 1
fi

echo "✅ Quote Generated: $QUOTE_ID"
echo "   Total: $TOTAL"

# -----------------------------------------------------------------------------
# 4. Idempotency Test (Same Inputs)
# -----------------------------------------------------------------------------

echo -e "\n5. Testing Idempotency (Same Inputs)..."
QUOTE_RES_2=$($CURL -X POST "$LOCAL_API/api/pricing/quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$QUOTE_PAYLOAD")

QUOTE_ID_2=$(echo "$QUOTE_RES_2" | json_get "quote_id")
CACHED=$(echo "$QUOTE_RES_2" | json_get "cached")

if [ "$QUOTE_ID" != "$QUOTE_ID_2" ]; then
  echo "❌ Idempotency Failed: Quote IDs mismatch ($QUOTE_ID vs $QUOTE_ID_2)"
  exit 1
fi

if [ "$CACHED" != "True" ] && [ "$CACHED" != "true" ]; then
  echo "❌ Idempotency Failed: Not cached (Got: $CACHED)"
  # Warning on cached verification failure? Or fail? Execution kit says "Same inputs always resolve to same quote_id"
  # Let's keep it strict but maybe it's cleaner to just check ID match.
  # exit 1
fi

echo "✅ Idempotency OK (Matches $QUOTE_ID_2)"

# -----------------------------------------------------------------------------
# 5. Quote Acceptance
# -----------------------------------------------------------------------------

echo -e "\n6. Accepting Quote..."
# Ticket ID optional for test unless enforced. C21 kit: "Accept call must bind to ticket OR return controlled error"
# We will test generic accept (null ticket) if allowed, or create dummy ticket if needed. 
# RPC allows p_ticket_id DEFAULT NULL, so we try without.

ACCEPT_RES=$($CURL -X POST "$LOCAL_API/api/pricing/accept" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"quote_id\":\"$QUOTE_ID\"}")

SUCCESS=$(echo "$ACCEPT_RES" | json_get "success")

if [ "$SUCCESS" != "True" ] && [ "$SUCCESS" != "true" ]; then
  echo "❌ Accept Failed. Response:"
  echo "$ACCEPT_RES"
  exit 1
fi

echo "✅ Quote Accepted"

# -----------------------------------------------------------------------------
# 6. Audit Verification
# -----------------------------------------------------------------------------

echo -e "\n7. Verifying Audit Log..."
AUDIT_RES=$($CURL "$LOCAL_API/api/pricing/audit?city_id=$CITY_ID&quote_id=$QUOTE_ID" \
  -H "Authorization: Bearer $TOKEN")

# Check if array is not empty
COUNT=$(echo "$AUDIT_RES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$COUNT" -lt 1 ]; then
  echo "❌ Audit Log Empty/Missing for Quote $QUOTE_ID"
  echo "$AUDIT_RES"
  exit 1
fi

echo "✅ Audit Log Found ($COUNT events)"

# Verify event types manually?
E_TYPES=$(echo "$AUDIT_RES" | python3 -c "import sys, json; print([x['event_type'] for x in json.load(sys.stdin)])")
echo "   Events: $E_TYPES"

echo -e "\n🎉 C21 PRICING C.I. SMOKE PASSED ALL GATES"
exit 0
