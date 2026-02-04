/**
 * C19 Phase 5: Shared Utilities
 * Common helper functions for all verification scripts
 * 
 * v1 Compliance Requirements:
 * - Determinism: seeded PRNG + frozen timestamp
 * - Confidence normalization: handles 0-100 and 0-1 scales
 * - No skips: scripts must FAIL if gated buckets lack samples
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from 'crypto';
import { performance } from "node:perf_hooks";

export type Json = Record<string, any>;

// ============================================================================
// DETERMINISM: Seeded PRNG + Frozen Time
// ============================================================================

/**
 * Frozen timestamp for CI determinism.
 * All scripts must use this instead of new Date().
 */
export function getFrozenNow(): Date {
    const frozenStr = process.env.C19_FROZEN_NOW;
    if (frozenStr) return new Date(frozenStr);
    // Fallback for local mode only
    return new Date();
}

export function nowIso(): string {
    return getFrozenNow().toISOString();
}

/**
 * Generate a deterministic UUID v4 from a string key.
 * Used for CI fixtures to ensure IDs are valid UUIDs but reproducible.
 */
export function getDeterministicUUID(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex');
    // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // version 4
        (parseInt(hash.substring(16, 17), 16) & 0x3 | 0x8).toString(16) + hash.substring(17, 20), // variant 1
        hash.substring(20, 32)
    ].join('-');
}

/**
 * Seeded PRNG (Mulberry32) for reproducible fixture generation.
 * Seed from C19_RNG_SEED env var (default 42).
 */
let _rngState: number | null = null;

function getRngState(): number {
    if (_rngState === null) {
        const seedEnv = process.env.C19_RNG_SEED;
        const n = seedEnv ? parseInt(seedEnv, 10) : 42;
        _rngState = Number.isFinite(n) ? n : 42;
    }
    return _rngState;
}

/**
 * Seeded random number generator (Mulberry32).
 * Returns value in [0, 1).
 */
export function seededRandom(): number {
    let t = (_rngState = getRngState() + 0x6d2b79f5);
    _rngState = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Reset RNG state (for testing).
 */
export function resetRng(seed = 42): void {
    _rngState = seed;
}

// ============================================================================
// CONFIDENCE NORMALIZATION (handles 0-100 and 0-1 scales)
// ============================================================================

export type ConfidenceTier = "HIGH" | "MID" | "LOW";

/**
 * Normalize confidence to 0-1 scale.
 * Handles inputs like 0.85 (already normalized) or 85 (percentage).
 */
export function normalizeConfidence(c: number): number {
    if (c > 1) return c / 100;
    return c;
}

/**
 * Get confidence tier from normalized (0-1) value.
 * HIGH: >= 0.80, MID: >= 0.50, LOW: < 0.50
 */
export function confidenceTier(c: number): ConfidenceTier {
    const x = normalizeConfidence(c);
    if (x >= 0.8) return "HIGH";
    if (x >= 0.5) return "MID";
    return "LOW";
}

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

export function assert(cond: any, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

export function percentile(values: number[], p: number): number {
    assert(values.length > 0, "percentile(): empty array");
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

export function mean(values: number[]): number {
    assert(values.length > 0, "mean(): empty array");
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate APE with epsilon protection.
 */
export function calculateApe(actual: number, predicted: number, eps = 1): number {
    return Math.abs(actual - predicted) / Math.max(eps, actual);
}

/**
 * Calculate MAPE from arrays.
 */
export function mape(actual: number[], predicted: number[], eps = 1): number {
    assert(actual.length === predicted.length, "MAPE length mismatch");
    assert(actual.length > 0, "MAPE requires non-empty arrays");
    const apes = actual.map((y, i) => calculateApe(y, predicted[i], eps));
    return mean(apes) * 100;
}

/**
 * Spearman correlation with average-rank for ties.
 * Returns value in [-1, 1].
 */
export function spearman(x: number[], y: number[]): number {
    assert(x.length === y.length && x.length > 1, "spearman requires same-length arrays of size > 1");
    const rx = rank(x);
    const ry = rank(y);
    return pearson(rx, ry);
}

function pearson(x: number[], y: number[]): number {
    const mx = mean(x);
    const my = mean(y);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < x.length; i++) {
        const a = x[i] - mx;
        const b = y[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    if (dx === 0 || dy === 0) return 0;
    return num / Math.sqrt(dx * dy);
}

function rank(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
        let j = i;
        while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
        const avgRank = (i + 1 + j) / 2; // 1-based average
        for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
        i = j;
    }
    return ranks;
}

/**
 * Build confidence quintiles (5 bins) for monotonic calibration test.
 */
export interface CalibrationBin {
    bin: number;
    n: number;
    avgConf: number;
    mape: number;
}

export function buildCalibrationQuintiles(
    samples: { confidence: number; actual: number; predicted: number }[]
): CalibrationBin[] {
    assert(samples.length >= 5, "buildCalibrationQuintiles requires >= 5 samples");

    // Sort by normalized confidence
    const sorted = [...samples].sort(
        (a, b) => normalizeConfidence(a.confidence) - normalizeConfidence(b.confidence)
    );

    const bins: CalibrationBin[] = [];
    const binCount = 5;

    for (let b = 0; b < binCount; b++) {
        const s = Math.floor((b / binCount) * sorted.length);
        const e = Math.floor(((b + 1) / binCount) * sorted.length);
        const chunk = sorted.slice(s, Math.max(e, s + 1));

        const actual = chunk.map(r => r.actual);
        const pred = chunk.map(r => r.predicted);
        const confs = chunk.map(r => normalizeConfidence(r.confidence));

        bins.push({
            bin: b + 1,
            n: chunk.length,
            avgConf: mean(confs),
            mape: mape(actual, pred),
        });
    }

    return bins;
}

/**
 * Check monotonic calibration (MAPE non-increasing as confidence increases).
 */
export function checkMonotonicCalibration(bins: CalibrationBin[]): { ok: boolean; violations: string[] } {
    const violations: string[] = [];

    for (let i = 1; i < bins.length; i++) {
        // Higher bin = higher confidence = should have LOWER mape
        if (bins[i].mape > bins[i - 1].mape) {
            violations.push(
                `Bin ${bins[i].bin} MAPE ${bins[i].mape.toFixed(2)}% > Bin ${bins[i - 1].bin} ${bins[i - 1].mape.toFixed(2)}%`
            );
        }
    }

    return { ok: violations.length === 0, violations };
}

// ============================================================================
// FILE I/O
// ============================================================================

export function ensureDir(path: string): void {
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function writeArtifacts(outDir: string, baseName: string, json: Json, markdown: string): void {
    ensureDir(outDir);
    writeFileSync(`${outDir}/${baseName}.json`, JSON.stringify(json, null, 2));
    writeFileSync(`${outDir}/${baseName}.md`, markdown);
}

export async function timedFetch(input: RequestInfo, init?: RequestInit): Promise<{ ms: number; status: number; body: any }> {
    const t0 = performance.now();
    const res = await fetch(input, init);
    const ms = performance.now() - t0;
    let body: any = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text().catch(() => null);
    return { ms, status: res.status, body };
}

export function templateReplace(str: string, vars: Record<string, string>): string {
    return str.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, k) => vars[k] ?? `\${${k}}`);
}

export function envOrThrow(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

// ============================================================================
// THRESHOLDS (v1 Spec)
// ============================================================================

/**
 * MAPE Thresholds for C19 Phase 5 Gates
 */
export const MAPE_THRESHOLDS = {
    "7d": { HIGH: 25, MID: 40 },
    "30d": { HIGH: 30, MID: 45 }
} as const;

/**
 * Minimum samples required per gated bucket in CI mode.
 * If fewer samples, script must FAIL (no skips).
 */
export const MIN_SAMPLES_PER_BUCKET = 10;

/**
 * Spearman correlation threshold for calibration.
 */
export const MIN_SPEARMAN_CORRELATION = 0.30;

/**
 * Performance Budget Thresholds (p95 in ms)
 */
export const PERF_BUDGETS_MS: Record<string, number> = {
    dashboardSummary: 500,
    reorderQueue: 700,
    partDeepDive: 900,
    locationDeepDive: 900,
    computeDemand: 10000,
    computeForecast: 10000,
    generateReorders: 10000
};

/**
 * Check if running in CI mode.
 */
export function isCI(): boolean {
    return process.env.C19_TEST_MODE === 'ci' || !!process.env.CI;
}

/**
 * Fail with artifacts - writes JSON + MD artifacts before exiting with code 1.
 * Use this for early failures in CI so evidence is always captured.
 */
export function failWithArtifacts(
    outDir: string,
    baseName: string,
    errors: string[],
    extraJson: Json = {}
): never {
    const startedAt = getFrozenNow().toISOString();

    const json: Json = {
        ok: false,
        startedAt,
        errors,
        ...extraJson,
    };

    const md = [
        `# ${baseName} — FAILED`,
        `- **Started:** ${startedAt}`,
        `- **Result:** ❌ FAIL`,
        ``,
        `## Errors`,
        ...errors.map(e => `- ${e}`),
    ].join('\n');

    writeArtifacts(outDir, baseName, json, md);

    console.error(`\n❌ Artifacts written to ${outDir}/${baseName}.{json,md}`);
    process.exit(1);
}
