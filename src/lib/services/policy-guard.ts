// C15.1: Policy Guard Service
// Enforces governance locks and trust-value blocking

import { createClient } from '@/lib/supabase/server';
import type { ValueScores, ThresholdConfig } from '@/lib/types/value-function';
import { DEFAULT_THRESHOLDS } from '@/lib/types/value-function';

export interface PolicyGuardResult {
    allowed: boolean;
    reason?: string;
    blocked_by?: string;
}

export class PolicyGuardService {
    private static readonly GOVERNANCE_LOCKS = {
        NO_AUTO_PENALIZE: true,
        NO_AUTO_FIRING: true,
        NO_PUBLIC_RANKING: true,
        NO_CUSTOMER_NUMERIC_SCORES: true,
    };

    /**
     * Compatibility wrapper (C15.3 processor calls this)
     */
    static async shouldAllowRecommendation(
        recommendationType: string,
        valueScores: ValueScores,
        thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
    ): Promise<PolicyGuardResult> {
        return this.validateRecommendation(recommendationType, valueScores, thresholds);
    }

    /**
     * Canonical validator
     */
    static async validateRecommendation(
        recommendationType: string,
        valueScores: ValueScores,
        thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
    ): Promise<PolicyGuardResult> {
        // 1) Trust guard
        if (valueScores.trust_value < thresholds.trust_value_minimum) {
            await this.logBlock(recommendationType, valueScores, 'trust_value_too_low');
            return {
                allowed: false,
                reason: `Trust Value too low: ${valueScores.trust_value} < ${thresholds.trust_value_minimum}`,
                blocked_by: 'trust_value_guard',
            };
        }

        // 2) Governance guard
        if (valueScores.governance_value < thresholds.governance_value_minimum) {
            await this.logBlock(recommendationType, valueScores, 'governance_value_too_low');
            return {
                allowed: false,
                reason: `Governance Value too low: ${valueScores.governance_value} < ${thresholds.governance_value_minimum}`,
                blocked_by: 'governance_value_guard',
            };
        }

        // 3) Hard-stop: auto actions
        if (this.isAutoActionRecommendation(recommendationType)) {
            await this.logBlock(recommendationType, valueScores, 'auto_action_forbidden');
            return {
                allowed: false,
                reason: 'Automatic penalties and firing are forbidden by governance',
                blocked_by: 'auto_action_guard',
            };
        }

        // 4) Hard-stop: public ranking
        if (this.isPublicRankingRecommendation(recommendationType)) {
            await this.logBlock(recommendationType, valueScores, 'public_ranking_forbidden');
            return {
                allowed: false,
                reason: 'Public rankings are forbidden by governance',
                blocked_by: 'public_ranking_guard',
            };
        }

        await this.logAllow(recommendationType, valueScores);
        return { allowed: true };
    }

    private static isAutoActionRecommendation(type: string): boolean {
        const forbiddenPatterns = ['auto_penalize', 'auto_fire', 'automatic_termination', 'auto_suspend'];
        return forbiddenPatterns.some((p) => type.toLowerCase().includes(p));
    }

    private static isPublicRankingRecommendation(type: string): boolean {
        const forbiddenPatterns = ['public_ranking', 'public_leaderboard', 'customer_numeric_score'];
        return forbiddenPatterns.some((p) => type.toLowerCase().includes(p));
    }

    /**
     * Log a Blocked decision to the audit log
     */
    private static async logBlock(recommendationType: string, valueScores: ValueScores, reason: string) {
        const { AuditLoggerService } = await import('./audit-logger');

        await AuditLoggerService.log({
            ai_module: 'policy_guard',
            action_taken: 'RECOMMENDATION_BLOCKED',
            data_points: {
                recommendation_type: recommendationType,
                block_reason: reason
            },
            result_meta: {
                policy_guard_result: 'blocked',
                value_scores: valueScores,
                governance_value_at_time: valueScores.governance_value,
            },
            confidence_score: 1.0,
            ethical_check_passed: true
        });
    }

    /**
     * Log an Allowed decision to the audit log
     */
    private static async logAllow(recommendationType: string, valueScores: ValueScores) {
        const { AuditLoggerService } = await import('./audit-logger');

        await AuditLoggerService.log({
            ai_module: 'policy_guard',
            action_taken: 'RECOMMENDATION_ALLOWED',
            data_points: {
                recommendation_type: recommendationType
            },
            result_meta: {
                policy_guard_result: 'allowed',
                value_scores: valueScores,
                governance_value_at_time: valueScores.governance_value,
            },
            confidence_score: 1.0,
            ethical_check_passed: true
        });
    }
}
