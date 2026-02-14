#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────
# C22 — PWA Integrity Verification
# Run AFTER `npm run build`. Validates that the
# production build produced the required PWA
# artifacts and that manifest.json is well-formed.
# ─────────────────────────────────────────────────

ROOT="$(pwd)"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); ERRORS+=("$1"); }
ERRORS=()

echo "🔍 PWA Integrity Check"
echo "───────────────────────"

# 0. Repo root guard
if [ ! -f "$ROOT/package.json" ]; then
  echo "ERROR: package.json not found. Run from repo root."
  exit 1
fi

# 1. Build artifacts
echo ""
echo "▸ Build artifacts"
if [ -f ".next/routes-manifest.json" ]; then
  pass ".next/routes-manifest.json exists"
else
  fail ".next/routes-manifest.json not found — run 'npm run build' first"
fi

# 2. Service Worker
echo ""
echo "▸ Service Worker"
if [ -f "public/sw.js" ]; then
  pass "public/sw.js exists"
else
  fail "public/sw.js not found"
fi

if [ -f "public/sw.js" ] && [ -s "public/sw.js" ]; then
  pass "public/sw.js is non-empty"
elif [ -f "public/sw.js" ]; then
  fail "public/sw.js is empty"
fi

# 3. Manifest
echo ""
echo "▸ PWA Manifest"
if [ -f "public/manifest.json" ]; then
  pass "public/manifest.json exists"
else
  fail "public/manifest.json not found"
fi

# 4. Manifest JSON validation (uses Node — no jq dependency)
if [ -f "public/manifest.json" ]; then
  if node - <<'NODE'
const fs = require('fs');
const path = 'public/manifest.json';
let data;
try {
  data = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (e) {
  console.error('  ❌ manifest.json is not valid JSON');
  process.exit(1);
}

const required = ['name', 'short_name', 'start_url', 'icons'];
let ok = true;
for (const k of required) {
  if (!(k in data)) {
    console.error(`  ❌ manifest.json missing required field: ${k}`);
    ok = false;
  }
}

if (Array.isArray(data.icons) && data.icons.length > 0) {
  const hasValid = data.icons.some(
    i => i && typeof i.src === 'string' && i.src.length > 0
      && typeof i.sizes === 'string' && i.sizes.length > 0
  );
  if (hasValid) {
    console.log('  ✅ manifest.json has valid icon entries');
  } else {
    console.error('  ❌ manifest.json icons[] — no item has both src and sizes');
    ok = false;
  }
} else {
  console.error('  ❌ manifest.json icons must be a non-empty array');
  ok = false;
}

if (ok) {
  console.log('  ✅ manifest.json required fields present');
} else {
  process.exit(1);
}
NODE
  then
    PASS=$((PASS + 2))
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("manifest.json validation failed")
  fi
fi

# 5. Summary
echo ""
echo "───────────────────────"
if [ "$FAIL" -gt 0 ]; then
  echo "❌ PWA integrity: FAILED ($FAIL issue(s))"
  for err in "${ERRORS[@]}"; do
    echo "   → $err"
  done
  exit 1
else
  echo "✅ PWA integrity: OK ($PASS checks passed)"
  exit 0
fi
