#!/bin/bash
# scripts/verify_ci.sh
# CI-Grade Verification Script for ExpansionOS
# Required env vars:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   JT_TEST_BASE_URL
#   JT_TEST_MANAGER_EMAIL
#   JT_TEST_MANAGER_PASSWORD
#   JT_TEST_CITY_ID
set -euo pipefail

echo "DEBUG: Script started"

require_env () {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "❌ Missing required env var: $name"
    exit 1
  fi
}

# Source .env.local if present AND required vars missing (LOCAL ONLY).
# In CI, env vars should be injected; .env.local is optional fallback.
if [ -f .env.local ] && [ -z "${JT_TEST_MANAGER_EMAIL:-}" ]; then
  echo "Loading from .env.local..."
  # Simple source with set +a to avoid exporting everything
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

echo "--- ExpansionOS CI Verification ---"
echo "Target: $LOCAL_API"
echo "User: $EMAIL"
echo "City: $CITY_ID"

# Curl safety: bounded time + retries to prevent hangs
CURL_OPTS=(--fail --silent --show-error --connect-timeout 5 --max-time 25 --retry 2 --retry-delay 1)
CURL="curl ${CURL_OPTS[*]}"

# Cleanup always
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

# Helper: extract JSON field reliably using python3
json_get () {
  local key="$1"
  python3 -c "
import json,sys
try:
  data=json.load(sys.stdin)
  print(data.get('$key',''))
except Exception:
  pass
"
}

echo -e "\n0. Health precheck..."
$CURL -o /dev/null -w "%{http_code}" "$LOCAL_API/api/health" | grep -qE '^(200|204)$' || {
  echo "❌ Health check failed (server not ready)."
  exit 1
}
echo "✅ Server healthy"

# 1) Authenticate with Supabase
echo -e "\n1. Authenticating with Supabase..."
# Token endpoint is external (Supabase), keeping standard curl for it or using $CURL? 
# Using basic curl for Supabase to avoid interfering with their timeouts, 
# BUT strict timeouts are good everywhere. Let's use standard curl for external to be safe,
# or just applying options manually. Let's use stricter manual opts for external.
TOKEN_RES="$(curl -fsS --connect-timeout 10 --max-time 30 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"

TOKEN="$(echo "$TOKEN_RES" | json_get "access_token")"

if [ -z "$TOKEN" ]; then
  echo "❌ Auth Failed: no access_token in response"
  exit 1
fi
echo "✅ Token Obtained"

# 2) Create Session (P0 Security Check)
echo -e "\n2. Creating Session (P0 Security Check)..."
# Using $CURL (includes fail/silent/show-error)
# Note: $CURL fail means it exits with non-zero on 4xx/5xx. 
# We need to capture http_code separately or handle failure logic.
# For Session Create Success (200), $CURL is fine.
HTTP_CODE="$($CURL -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -X POST "$LOCAL_API/api/auth/session/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceFingerprint":"ci-script","ipAddress":"127.0.0.1","userAgent":"curl"}')"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Session Create Failed: $HTTP_CODE"
  exit 1
fi
echo "✅ Session Created (Secure Mode)"

# 3) Negative Test: No Token -> 401
echo -e "\n3. Testing Unauthorized Session Create..."
# Here we expect failure (401), so $CURL --fail might trigger script exit if we don't catch it.
# We turn off --fail for this specific negative test call or handle "|| true"
HTTP_CODE_FAIL="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 -X POST "$LOCAL_API/api/auth/session/create" \
  -H "Content-Type: application/json" \
  -d '{"deviceFingerprint":"ci-fail-test","ipAddress":"127.0.0.1","userAgent":"curl"}' || true)"

if [ "$HTTP_CODE_FAIL" != "401" ]; then
  echo "❌ FAIL: Expected 401, got $HTTP_CODE_FAIL"
  exit 1
fi
echo "✅ Unauthorized Request Blocked (401)"

# 4) List Scenarios
echo -e "\n4. GET /api/expansion/scenarios"
# LIST_CODE="$($CURL -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
#  -H "Authorization: Bearer $TOKEN" \
#  "$LOCAL_API/api/expansion/scenarios?city_id=$CITY_ID")"
# Note: $CURL contains --fail. If 200, it's fine.
LIST_CODE="$($CURL -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Authorization: Bearer $TOKEN" \
  "$LOCAL_API/api/expansion/scenarios?city_id=$CITY_ID")"

if [ "$LIST_CODE" != "200" ]; then
  echo "❌ List Scenarios Failed: $LIST_CODE"
  exit 1
fi
echo "✅ Scenarios Listed (200 OK)"

# 5) Create Scenario
echo -e "\n5. POST /api/expansion/scenarios"
CREATE_CODE="$($CURL -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$LOCAL_API/api/expansion/scenarios" \
  -d "{\"name\":\"CI Shell Verify $(date +%s)\",\"weights\":{\"rent\":30,\"traffic\":70},\"city_id\":\"$CITY_ID\"}")"

if [ "$CREATE_CODE" != "201" ]; then
  echo "❌ Create Scenario Failed: $CREATE_CODE"
  exit 1
fi
echo "✅ Scenario Created (201 Created)"

# 6) Audit Logs
echo -e "\n6. GET /api/expansion/audit"
AUDIT_CODE="$($CURL -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Authorization: Bearer $TOKEN" \
  "$LOCAL_API/api/expansion/audit")"

if [ "$AUDIT_CODE" != "200" ]; then
  echo "❌ Audit Logs Failed: $AUDIT_CODE"
  exit 1
fi
echo "✅ Audit Logs Accessed (200 OK)"

# Cleanup handled by trap, but explicit message good
echo -e "\n--- ✅ Verification Complete (CI PASS) ---"
