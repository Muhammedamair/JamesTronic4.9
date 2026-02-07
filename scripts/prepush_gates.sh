#!/bin/bash
set -e

echo ">>> [GEN-Z Gate A] Checking for untracked source files..."
UNTRACKED=$(git ls-files --others --exclude-standard | grep -E '^(src|app|components|lib)/' || true)
if [ -n "$UNTRACKED" ]; then
    echo "❌ ERROR: Untracked source files detected. Vercel build will fail."
    echo "$UNTRACKED"
    exit 1
fi
echo "✅ No untracked source files."

echo ">>> [GEN-Z Gate B] Running local clean build (npm ci + build)..."
npm ci
npm run build
echo "✅ Local build passed."

echo ">>> [GEN-Z Gate C] Verifying build stability with secrets unset..."
# Simulate Vercel Preview environment by unsetting service role key
SUPABASE_SERVICE_ROLE_KEY="" npm run build
echo "✅ Secret-agnostic build passed."

echo "🚀 ALL GATES PASSED. Ready to push."
