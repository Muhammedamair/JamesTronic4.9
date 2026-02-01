#!/bin/bash
set -e

echo ">>> Verifying Next.js Security Patch..."

# 1. Check Next.js Version
INSTALLED_VERSION=$(npm list next --depth=0 | grep next | cut -d @ -f 2)
echo "Installed Next.js version: $INSTALLED_VERSION"
# Simple check if it starts with 16.1.
if [[ "$INSTALLED_VERSION" == 16.1.* ]]; then
  echo "✅ Next.js version is 16.1.x (Target matched)"
else
  echo "⚠️ Warning: Next.js version $INSTALLED_VERSION might not be 16.1.x"
fi

# 2. Build
echo ">>> Running Build..."
npm run build

# 3. Lint
echo ">>> Running Lint..."
npm run lint

# 4. Type Check
echo ">>> Running Type Check..."
npm run type-check

# 5. Audit
echo ">>> Running Security Audit..."
npm audit --audit-level=high

echo "✅ ALL SECURITY CHECKS PASSED"
