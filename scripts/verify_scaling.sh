#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────
# C22 — Scaling Law Compliance Verification
# Run AFTER `npm run build`. 
# Enforces size budgets for:
# - Total static build size (.next/static)
# - Largest single JS chunk
# - Per-route estimated First Load JS
# ─────────────────────────────────────────────────

ROOT="$(pwd)"

# Default Thresholds (can be overridden by env vars)
MAX_STATIC_MB="${SCALE_MAX_STATIC_MB:-20}"
MAX_ROUTE_KB="${SCALE_MAX_ROUTE_KB:-500}"
MAX_CHUNK_KB="${SCALE_MAX_CHUNK_KB:-800}"

echo "🔍 Scaling Compliance Check"
echo "─────────────────────────"
echo "  Thresholds:"
echo "  ▸ Max Total Static:     ${MAX_STATIC_MB} MB"
echo "  ▸ Max Route JS (est):   ${MAX_ROUTE_KB} KB"
echo "  ▸ Max Single Chunk:     ${MAX_CHUNK_KB} KB"
echo ""

# 0. Repo root guard
if [ ! -f "$ROOT/package.json" ]; then
  echo "ERROR: package.json not found. Run from repo root."
  exit 1
fi

# 1. Build artifacts guard
if [ ! -d ".next" ] || [ ! -f ".next/build-manifest.json" ]; then
  echo "❌ Error: .next/build-manifest.json not found."
  echo "   Run 'npm run build' first."
  exit 1
fi

# Run Node.js script to verify budgets
node - "$MAX_STATIC_MB" "$MAX_ROUTE_KB" "$MAX_CHUNK_KB" <<'NODE'
const fs = require('fs');
const path = require('path');

const [_, __, maxStaticMBStr, maxRouteKBStr, maxChunkKBStr] = process.argv;
const MAX_STATIC_MB = parseFloat(maxStaticMBStr);
const MAX_ROUTE_KB = parseFloat(maxRouteKBStr);
const MAX_CHUNK_KB = parseFloat(maxChunkKBStr);

const NEXT_DIR = path.resolve('.next');
const STATIC_DIR = path.join(NEXT_DIR, 'static');
const BUILD_MANIFEST = path.join(NEXT_DIR, 'build-manifest.json');
const APP_BUILD_MANIFEST = path.join(NEXT_DIR, 'app-build-manifest.json');

let FAIL = 0;
const errors = [];

function fail(msg) {
  errors.push(msg);
  FAIL++;
}

// Helper: Get file size in KB
function getFileSizeKB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size / 1024;
  } catch (e) {
    return 0; // File might not exist (e.g. map files, or referenced but not generated)
  }
}

// 2. Check Total Static Size
let totalStaticKB = 0;
let largestChunkKB = 0;
let largestChunkName = '';

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const kb = stat.size / 1024;
        totalStaticKB += kb;
        if (kb > largestChunkKB) {
          largestChunkKB = kb;
          largestChunkName = path.relative(STATIC_DIR, fullPath);
        }
      }
    }
  }
}

if (fs.existsSync(STATIC_DIR)) {
  scanDir(STATIC_DIR);
}

const totalStaticMB = totalStaticKB / 1024;
console.log(`▸ Total Static Size:    ${totalStaticMB.toFixed(2)} MB`);
if (totalStaticMB > MAX_STATIC_MB) {
  fail(`Total static size (${totalStaticMB.toFixed(2)} MB) exceeds limit of ${MAX_STATIC_MB} MB`);
} else {
  console.log(`  ✅ Within limit (${MAX_STATIC_MB} MB)`);
}

console.log(`▸ Largest Chunk:        ${largestChunkKB.toFixed(2)} KB (${largestChunkName})`);
if (largestChunkKB > MAX_CHUNK_KB) {
  fail(`Largest chunk (${largestChunkName}: ${largestChunkKB.toFixed(2)} KB) exceeds limit of ${MAX_CHUNK_KB} KB`);
} else {
  console.log(`  ✅ Within limit (${MAX_CHUNK_KB} KB)`);
}

// 3. Check Per-Route Budget
console.log("");
console.log("▸ Per-Route Bundle Analysis (Top 10)");
console.log("  (Estimated First Load JS based on manifest references)");

const routeSizes = [];
const checkedFiles = new Set(); // Avoid double counting shared chunks per route

function analyzeManifest(manifestPath, type) {
  if (!fs.existsSync(manifestPath)) {
    console.log(`  ℹ️  Skipping ${type} analysis (manifest not found)`);
    return;
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const pages = manifest.pages || {};
    
    for (const [route, files] of Object.entries(pages)) {
      if (!Array.isArray(files)) continue;
      
      let routeKB = 0;
      files.forEach(file => {
        // Build manifest paths are relative to .next/
        // e.g. "static/chunks/main-app.js"
        // We need to match valid JS/CSS files
        if (file.endsWith('.js') || file.endsWith('.css')) {
            const absPath = path.join(NEXT_DIR, file);
            routeKB += getFileSizeKB(absPath);
        }
      });
      
      routeSizes.push({ route, kb: routeKB, type });
    }
  } catch (e) {
    console.warn(`WARNING: Failed to parse ${type}: ${e.message}`);
  }
}

analyzeManifest(BUILD_MANIFEST, 'Pages (Page Router)');
analyzeManifest(APP_BUILD_MANIFEST, 'App (App Router)');

if (routeSizes.length === 0) {
  console.log("  ⚠️  No route manifests found or parsed. Skipping per-route analysis.");
  console.log("      (Relying on Total Static Size and Largest Chunk checks)");
} else {
  // Sort by size desc
  routeSizes.sort((a, b) => b.kb - a.kb);

  // Print Top 10
  routeSizes.slice(0, 10).forEach(r => {
    const status = r.kb > MAX_ROUTE_KB ? '❌' : '✅';
    console.log(`  ${status} [${r.type.split(' ')[0]}] ${r.route.padEnd(30)} : ${r.kb.toFixed(2)} KB`);
  });

  // Check all routes for violations
  let routeFailures = 0;
  routeSizes.forEach(r => {
    if (r.kb > MAX_ROUTE_KB) {
      fail(`Route ${r.route} (${r.kb.toFixed(2)} KB) exceeds limit of ${MAX_ROUTE_KB} KB`);
      routeFailures++;
    }
  });

  if (routeFailures > 0) {
      console.log(`\n  ⚠️  ${routeFailures} route(s) exceeded the ${MAX_ROUTE_KB} KB budget.`);
  }
}

console.log("\n─────────────────────────");

if (FAIL > 0) {
  console.error(`❌ Scaling Verification Failed with ${FAIL} error(s):`);
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
} else {
  console.log(`✅ Scaling Verification OK`);
  process.exit(0);
}

NODE
