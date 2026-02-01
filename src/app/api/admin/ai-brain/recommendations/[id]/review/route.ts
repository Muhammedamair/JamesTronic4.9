
import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';
import { AuditLoggerService } from '@/lib/services/audit-logger';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, review_note } = body;

        // 1. Validate Input
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid status. Must be APPROVED or REJECTED.'
            }, { status: 400 });
        }

        // 2. Admin Auth Check (supports Bearer token + cookies)
        const { supabase, user } = await requireAdmin();

        // 3. Update Recommendation
        // 3. Update Recommendation
        // We first fetch the existing one to ensure it exists and get context for audit
        // Query WITHOUT join first to avoid 404s if the relationship is broken or missing
        const { data: existingRec, error: fetchError } = await supabase
            .from('ai_recommendations')
            .select('event_id, status, recommendation_type')
            .eq('id', id)
            .single();

        if (fetchError || !existingRec) {
            console.error('Recommendation fetch error:', fetchError);
            return NextResponse.json({ success: false, error: 'Recommendation not found' }, { status: 404 });
        }

        // Try to fetch linked event details safely (best-effort)
        let linkedEntityType = null;
        let linkedEntityId = null;

        if (existingRec.event_id) {
            const { data: relatedEvent } = await supabase
                .from('ai_events')
                .select('entity_type, entity_id')
                .eq('id', existingRec.event_id)
                .single();

            if (relatedEvent) {
                linkedEntityType = relatedEvent.entity_type;
                linkedEntityId = relatedEvent.entity_id;
            }
        }

        const { data: updatedRec, error: updateError } = await supabase
            .from('ai_recommendations')
            .update({
                status: status,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                review_notes: review_note
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update recommendation:', updateError);
            return NextResponse.json({ success: false, error: 'Failed to update recommendation' }, { status: 500 });
        }

        // 4. Audit Log
        try {
            await AuditLoggerService.log({
                ai_module: 'admin',
                action_taken: 'RECOMMENDATION_REVIEWED',
                data_points: {
                    recommendation_id: id,
                    old_status: existingRec.status,
                    new_status: status,
                    reviewed_by: user.id,
                    // Enrich with human-readable reviewer details
                    reviewer_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
                    reviewer_email: user.email || null,
                    review_notes: review_note,
                    recommendation_type: existingRec.recommendation_type,
                    // Canonical keys for UI entity display
                    entity_type: linkedEntityType,
                    entity_id: linkedEntityId,
                    event_id: existingRec.event_id
                },
                result_meta: {
                    source: 'admin_review_endpoint',
                    recommendation_type: existingRec.recommendation_type,
                    event_id: existingRec.event_id
                },
                user_id: user.id
            }, supabase);
        } catch (auditError) {
            // Non-blocking catch for audit logging
            console.error('Audit log failed during review:', auditError);
        }

        return NextResponse.json({
            success: true,
            recommendation: updatedRec
        });

    } catch (error) {
        // Detailed error logging for debugging 500s
        console.error('Review endpoint CRITICAL error:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            error
        });

        if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
