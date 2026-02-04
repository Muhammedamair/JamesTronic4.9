import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';
import { ActionDispatcherService } from '@/lib/services/action-dispatcher';
import { AuditLoggerService } from '@/lib/services/audit-logger';
import { timeAgo } from '@/lib/utils/time';
import { ValueFunctionService } from '@/lib/services/value-function';
import { PolicyGuardService } from '@/lib/services/policy-guard';
import { ContextBuilderService } from '@/lib/services/context-builder';

const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH_SIZE = 20;

interface ProcessorResponse {
    success: boolean;
    processed_count: number;
    skipped_count: number;
    error_count: number;
    events?: Array<{
        event_id: string;
        entity_type: string;
        entity_id: string;
        value_score: number;
        recommendation_created: boolean;
        policy_result: 'allowed' | 'blocked';
    }>;
    error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ProcessorResponse>> {
    try {
        // Admin auth check (supports Bearer token + cookies)
        // Admin auth check (supports Bearer token + cookies)
        const { supabase } = await requireAdmin();

        // Parse request body
        const body = await request.json();
        const batchSize = Math.min(
            Math.max(1, body.batch_size || DEFAULT_BATCH_SIZE),
            MAX_BATCH_SIZE
        );

        // Fetch pending events
        const { data: events, error: fetchError } = await supabase
            .from('ai_events')
            .select('*')
            .eq('processed', false)
            .order('created_at', { ascending: true })
            .limit(batchSize);

        if (fetchError) {
            console.error('Failed to fetch events:', fetchError);
            return NextResponse.json({
                success: false,
                processed_count: 0,
                skipped_count: 0,
                error_count: 1,
                error: 'Failed to fetch events'
            }, { status: 500 });
        }

        if (!events || events.length === 0) {
            return NextResponse.json({
                success: true,
                processed_count: 0,
                skipped_count: 0,
                error_count: 0,
                events: []
            });
        }

        // Process each event
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const processedEvents: ProcessorResponse['events'] = [];

        for (const event of events) {
            try {
                // Idempotency check 1: value_function_scores
                const { data: existingScore } = await supabase
                    .from('value_function_scores')
                    .select('id')
                    .eq('event_id', event.id)
                    .maybeSingle();

                if (existingScore) {
                    skippedCount++;
                    continue;
                }

                // Idempotency check 2: ai_recommendations
                const { data: existingRec } = await supabase
                    .from('ai_recommendations')
                    .select('id')
                    .eq('event_id', event.id)
                    .maybeSingle();

                if (existingRec) {
                    skippedCount++;
                    continue;
                }

                // Build context
                const context = await ContextBuilderService.buildContext(
                    event.entity_type,
                    event.entity_id
                );

                // Calculate value scores
                const valueScores = await ValueFunctionService.calculateScores(context);

                // Check policy guard
                const policyResult = await PolicyGuardService.shouldAllowRecommendation(
                    event.event_type,
                    valueScores
                );

                // Insert value_function_scores
                const { error: scoreError } = await supabase
                    .from('value_function_scores')
                    .insert({
                        event_id: event.id,
                        ov: valueScores.operational_value,
                        tv: valueScores.trust_value,
                        bv: valueScores.brand_value,
                        lgv: valueScores.governance_value,
                        total_score: valueScores.composite_score,
                        weights: {
                            tv: 0.4,
                            ov: 0.3,
                            bv: 0.2,
                            lgv: 0.1
                        },
                        rationale: {
                            entity_type: event.entity_type,
                            entity_id: event.entity_id,
                            event_type: event.event_type,
                            signals: context,
                            policy_result: policyResult.allowed ? 'allowed' : 'blocked',
                            notes: policyResult.reason
                        }
                    });

                if (scoreError) {
                    console.error('Failed to insert value scores:', scoreError);
                    errorCount++;
                    continue;
                }

                // Generate recommendation (if allowed)
                let recommendationCreated = false;
                if (policyResult.allowed) {
                    const recommendationType = determineRecommendationType(event.event_type);
                    const urgency = determineUrgency(valueScores, event.event_type);

                    const { error: recError } = await supabase
                        .from('ai_recommendations')
                        .insert({
                            event_id: event.id,
                            recommendation_type: recommendationType,
                            recommendation_payload: {
                                entity_type: event.entity_type,
                                entity_id: event.entity_id,
                                urgency,
                                confidence_score: calculateConfidence(valueScores),
                                summary: generateRecommendationSummary(event, valueScores, urgency),
                                suggested_actions: generateSuggestedActions(event.event_type, valueScores),
                                policy_result: 'allowed',
                                score_snapshot: {
                                    ov: valueScores.operational_value,
                                    tv: valueScores.trust_value,
                                    bv: valueScores.brand_value,
                                    lgv: valueScores.governance_value,
                                    total_score: valueScores.composite_score
                                }
                            },
                            status: 'PENDING' // RECOMMENDATION_ONLY mode - requires admin approval
                        });

                    if (recError) {
                        console.error('Failed to insert recommendation:', recError);
                    } else {
                        recommendationCreated = true;
                    }
                }

                // Mark event as processed
                const { error: updateError } = await supabase
                    .from('ai_events')
                    .update({ processed: true })
                    .eq('id', event.id);

                if (updateError) {
                    console.error('Failed to mark event processed:', updateError);
                }

                // Write audit log for Recommendation Decision
                await AuditLoggerService.log({
                    ai_module: 'ai_processor',
                    action_taken: policyResult.allowed ? 'RECOMMENDATION_CREATED' : 'RECOMMENDATION_BLOCKED',
                    data_points: {
                        event_id: event.id,
                        entity_type: event.entity_type,
                        entity_id: event.entity_id,
                        event_type: event.event_type
                    },
                    result_meta: {
                        policy_result: policyResult.allowed ? 'allowed' : 'blocked',
                        policy_reason: policyResult.reason,
                        value_scores: valueScores,
                        recommendation_created: recommendationCreated
                    },
                    confidence_score: calculateConfidence(valueScores)
                });

                // Log overall processing completion (EVENT_PROCESSED)
                await AuditLoggerService.log({
                    ai_module: 'ai_processor',
                    action_taken: 'EVENT_PROCESSED',
                    data_points: {
                        event_id: event.id,
                        entity_type: event.entity_type,
                        entity_id: event.entity_id
                    },
                    result_meta: {
                        success: true,
                        processed_at: new Date().toISOString()
                    }
                });

                processedCount++;
                processedEvents.push({
                    event_id: event.id,
                    entity_type: event.entity_type,
                    entity_id: event.entity_id,
                    value_score: valueScores.composite_score,
                    recommendation_created: recommendationCreated,
                    policy_result: policyResult.allowed ? 'allowed' : 'blocked'
                });

            } catch (error) {
                console.error(`Error processing event ${event.id}:`, error);
                errorCount++;
            }
        }

        return NextResponse.json({
            success: true,
            processed_count: processedCount,
            skipped_count: skippedCount,
            error_count: errorCount,
            events: processedEvents
        });

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return NextResponse.json({
                success: false,
                processed_count: 0,
                skipped_count: 0,
                error_count: 0,
                error: error.message
            }, { status: 401 });
        }
        console.error('AI process API error:', error);
        return NextResponse.json({
            success: false,
            processed_count: 0,
            skipped_count: 0,
            error_count: 1,
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}

// Helper functions
function determineRecommendationType(eventType: string): string {
    const typeMap: Record<string, string> = {
        'sla_breach': 'ESCALATE_TICKET',
        'high_value_customer': 'VIP_TREATMENT',
        'compliance_violation': 'COMPLIANCE_REVIEW',
        'fraud_detected': 'FRAUD_INVESTIGATION',
        'low_satisfaction': 'CUSTOMER_OUTREACH',
        'technician_performance': 'TRAINING_RECOMMENDATION'
    };

    return typeMap[eventType] || 'GENERAL_REVIEW';
}

function determineUrgency(scores: any, eventType: string): 'critical' | 'high' | 'medium' | 'low' {
    // Trust value below 60 = critical
    if (scores.trust_value < 60) return 'critical';

    // Critical event types
    if (['fraud_detected', 'compliance_violation'].includes(eventType)) return 'critical';

    // Composite score based urgency
    if (scores.composite_score < 60) return 'high';
    if (scores.composite_score < 75) return 'medium';

    return 'low';
}

function calculateConfidence(scores: any): number {
    // Confidence based on composite score and data completeness
    // Higher scores = higher confidence
    return Math.min(100, Math.round(scores.composite_score * 1.1));
}

function generateRecommendationSummary(event: any, scores: any, urgency: string): string {
    const urgencyPrefix = urgency === 'critical' ? '🚨 CRITICAL: ' : urgency === 'high' ? '⚠️ HIGH PRIORITY: ' : '';

    return `${urgencyPrefix}${event.event_type.replace(/_/g, ' ').toUpperCase()} detected for ${event.entity_type} ${event.entity_id.substring(0, 8)}. Trust Value: ${scores.trust_value.toFixed(1)}, Composite Score: ${scores.composite_score.toFixed(1)}.`;
}

function generateSuggestedActions(eventType: string, scores: any): string[] {
    const actions: string[] = [];

    // Trust value based actions
    if (scores.trust_value < 70) {
        actions.push('Review trust history and recent interactions');
        actions.push('Implement enhanced monitoring');
    }

    // Event type specific actions
    const eventActions: Record<string, string[]> = {
        'sla_breach': ['Escalate to senior technician', 'Contact customer with status update', 'Review SLA terms'],
        'compliance_violation': ['Conduct compliance review', 'Document findings', 'Implement corrective actions'],
        'fraud_detected': ['Freeze suspicious activity', 'Contact fraud prevention team', 'Review transaction history'],
        'low_satisfaction': ['Schedule follow-up call', 'Offer service credit', 'Assign dedicated support agent']
    };

    if (eventActions[eventType]) {
        actions.push(...eventActions[eventType]);
    }

    // Operational value based
    if (scores.operational_value < 70) {
        actions.push('Review operational processes');
    }

    return actions.length > 0 ? actions : ['Review and take appropriate action'];
}
