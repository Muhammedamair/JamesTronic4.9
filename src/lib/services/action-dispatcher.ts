// C15.1: Action Dispatcher Service
// RECOMMENDATION_ONLY mode - NO auto-execution

import { createClient } from '@/lib/supabase/server';
import type { AiRecommendation, RecommendationRequest } from '@/lib/types/ai-recommendations';
import { PolicyGuardService } from './policy-guard';
import { ValueFunctionService } from './value-function';

export class ActionDispatcherService {

    /**
     * Generate a recommendation (does NOT auto-execute)
     * @param request - Recommendation request payload
     * @returns Created recommendation ID
     */
    static async generateRecommendation(
        request: RecommendationRequest
    ): Promise<string> {
        const supabase = await createClient();

        // 1. Get current value scores (if entity exists)
        let valueScores;
        if (request.entity_type && request.entity_id) {
            const { data: existingScore } = await supabase
                .from('value_function_scores')
                .select('*')
                .eq('entity_type', request.entity_type)
                .eq('entity_id', request.entity_id)
                .single();

            valueScores = existingScore;
        }

        // 2. Run policy guard
        if (valueScores) {
            const guardResult = await PolicyGuardService.validateRecommendation(
                request.recommendation_type,
                {
                    operational_value: valueScores.operational_value,
                    trust_value: valueScores.trust_value,
                    brand_value: valueScores.brand_value,
                    governance_value: valueScores.governance_value,
                    composite_score: valueScores.composite_score,
                }
            );

            if (!guardResult.allowed) {
                throw new Error(`Policy Guard blocked: ${guardResult.reason}`);
            }
        }

        // 3. Insert recommendation (status=pending)
        const { data: recommendation, error } = await supabase
            .from('ai_recommendations')
            .insert({
                recommendation_type: request.recommendation_type,
                entity_type: request.entity_type,
                entity_id: request.entity_id,
                title: request.title,
                description: request.description,
                rationale: request.rationale,
                confidence_score: request.confidence_score,
                urgency: request.urgency,
                status: 'pending',
                context: request.context,
            })
            .select('id')
            .single();

        if (error) {
            throw new Error(`Failed to create recommendation: ${error.message}`);
        }

        // 4. Audit log
        await this.logRecommendation(recommendation!.id, request);

        return recommendation!.id;
    }

    /**
     * Review a recommendation (approve/reject)
     * @param recommendationId - Recommendation ID
     * @param action - 'approve' or 'reject'
     * @param notes - Review notes
     */
    static async reviewRecommendation(
        recommendationId: string,
        action: 'approve' | 'reject',
        notes?: string
    ): Promise<void> {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Unauthorized: Must be authenticated to review recommendations');
        }

        const { error } = await supabase
            .from('ai_recommendations')
            .update({
                status: action === 'approve' ? 'approved' : 'rejected',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                review_notes: notes,
            })
            .eq('id', recommendationId);

        if (error) {
            throw new Error(`Failed to review recommendation: ${error.message}`);
        }

        // Audit log
        await supabase.from('ai_audit_logs').insert({
            actor: 'admin',
            action: `recommendation_${action}ed`,
            entity_type: 'recommendation',
            entity_id: recommendationId,
            decision: { action, notes },
            reasoning: `Admin ${action}ed recommendation: ${notes || 'No notes'}`,
            policy_guard_result: 'n/a',
        });
    }

    /**
     * CRITICAL: RECOMMENDATION_ONLY mode means NO auto-execution
     * This method is intentionally NOT implemented
     */
    static async executeRecommendation(recommendationId: string): Promise<void> {
        throw new Error(
            'GOVERNANCE_BLOCK: Auto-execution is forbidden. Recommendations require manual review and approval.'
        );
    }

    /**
     * Log recommendation generation to audit trail
     */
    private static async logRecommendation(
        recommendationId: string,
        request: RecommendationRequest
    ) {
        const supabase = await createClient();

        await supabase.from('ai_audit_log').insert({
            actor: 'action-dispatcher',
            action: 'recommendation_generated',
            entity_type: request.entity_type || 'global',
            entity_id: request.entity_id || 'n/a',
            decision: {
                recommendation_id: recommendationId,
                type: request.recommendation_type,
                confidence: request.confidence_score,
            },
            reasoning: `Generated ${request.urgency} urgency recommendation: ${request.title}`,
            policy_guard_result: 'allowed',
            metadata: request.context,
        });
    }
}
