#!/bin/bash
# =============================================================================
# CI Environment Guard Script
# =============================================================================
# Purpose: Prevent security misconfigurations from reaching production.
# Run this script in CI BEFORE any build or deploy step.
#
# Exit Codes:
#   0 - All checks passed
#   1 - Security violation detected (hard fail)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 Running Environment Guard Checks..."
echo ""

FAILED=0

# =============================================================================
# CHECK 1: DEV_TEST_PHONES must NOT exist in production
# =============================================================================
check_dev_test_phones() {
    echo "📋 Check 1: DEV_TEST_PHONES not in production"
    
    # Detect production context
    IS_PROD=false
    
    if [[ "$NODE_ENV" == "production" ]]; then
        IS_PROD=true
    fi
    
    if [[ "$VERCEL_ENV" == "production" ]]; then
        IS_PROD=true
    fi
    
    if [[ "$CI_ENVIRONMENT_NAME" == "production" ]]; then
        IS_PROD=true
    fi
    
    # Check if DEV_TEST_PHONES is set
    if [[ "$IS_PROD" == "true" ]] && [[ -n "$DEV_TEST_PHONES" ]]; then
        echo -e "   ${RED}✖ FAIL: DEV_TEST_PHONES is set in production!${NC}"
        echo -e "   ${RED}  This allows test OTP bypass in production.${NC}"
        echo -e "   ${RED}  Remove this environment variable immediately.${NC}"
        FAILED=1
    else
        echo -e "   ${GREEN}✔ PASS${NC}"
    fi
}

# =============================================================================
# CHECK 2: No .bak files in repository
# =============================================================================
check_backup_files() {
    echo "📋 Check 2: No backup files in repository"
    
    BAK_FILES=$(find . -type f \( -name "*.bak" -o -name "*.backup" -o -name "*.old" \) \
        -not -path "./node_modules/*" \
        -not -path "./.next/*" \
        -not -path "./.git/*" 2>/dev/null || true)
    
    if [[ -n "$BAK_FILES" ]]; then
        echo -e "   ${RED}✖ FAIL: Backup files found in repository:${NC}"
        echo "$BAK_FILES" | while read -r file; do
            echo -e "   ${RED}  - $file${NC}"
        done
        FAILED=1
    else
        echo -e "   ${GREEN}✔ PASS${NC}"
    fi
}

# =============================================================================
# CHECK 3: No duplicate app roots (/app AND /src/app)
# =============================================================================
check_duplicate_app_roots() {
    echo "📋 Check 3: No duplicate app roots"
    
    HAS_ROOT_APP=false
    HAS_SRC_APP=false
    
    if [[ -d "./app" ]] && [[ -f "./app/layout.tsx" || -f "./app/page.tsx" ]]; then
        HAS_ROOT_APP=true
    fi
    
    if [[ -d "./src/app" ]] && [[ -f "./src/app/layout.tsx" || -f "./src/app/page.tsx" ]]; then
        HAS_SRC_APP=true
    fi
    
    if [[ "$HAS_ROOT_APP" == "true" ]] && [[ "$HAS_SRC_APP" == "true" ]]; then
        echo -e "   ${RED}✖ FAIL: Both /app and /src/app directories exist${NC}"
        echo -e "   ${RED}  This causes non-deterministic Next.js routing.${NC}"
        echo -e "   ${RED}  Choose one canonical app directory.${NC}"
        FAILED=1
    else
        echo -e "   ${GREEN}✔ PASS${NC}"
    fi
}

# =============================================================================
# CHECK 4: ADMIN_ENGINE_REGISTRY exists (governance)
# =============================================================================
check_admin_registry() {
    echo "📋 Check 4: Admin Engine Registry exists"
    
    if [[ ! -f "./src/components/admin/layout/ADMIN_ENGINE_REGISTRY.ts" ]]; then
        echo -e "   ${YELLOW}⚠ WARN: ADMIN_ENGINE_REGISTRY.ts not found${NC}"
        echo -e "   ${YELLOW}  Sidebar may not render correctly.${NC}"
        # Warning only, not a hard fail
    else
        echo -e "   ${GREEN}✔ PASS${NC}"
    fi
}

# =============================================================================
# Run all checks
# =============================================================================
check_dev_test_phones
check_backup_files
check_duplicate_app_roots
check_admin_registry

echo ""

if [[ $FAILED -eq 1 ]]; then
    echo -e "${RED}❌ ENVIRONMENT GUARD FAILED${NC}"
    echo -e "${RED}   Fix the issues above before proceeding.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ ALL ENVIRONMENT GUARD CHECKS PASSED${NC}"
    exit 0
fi
