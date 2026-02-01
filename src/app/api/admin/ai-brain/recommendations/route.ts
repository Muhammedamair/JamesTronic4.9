// C15.1: AI Recommendations API
// GET /api/admin/ai-brain/recommendations - List pending recommendations
// POST /api/admin/ai-brain/recommendations - Review recommendation

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';
import { ActionDispatcherService } from '@/lib/services/action-dispatcher';

export async function GET(request: NextRequest) {
    try {
        // Admin auth check (supports Bearer token + cookies)
        const { supabase } = await requireAdmin();

        // Parse query params
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'PENDING';
        const urgency = searchParams.get('urgency');

        // Build query
        let query = supabase
            .from('ai_recommendations')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by status (support both uppercase and lowercase)
        if (status && status !== 'all' && status !== 'ALL') {
            query = query.eq('status', status.toUpperCase());
        }

        if (urgency) {
            query = query.eq('urgency', urgency);
        }

        const { data: recommendations, error } = await query;

        if (error) {
            console.error('Recommendations query error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch recommendations' },
                { status: 500 }
            );
        }

        return NextResponse.json({ recommendations });

    } catch (error: any) {
        console.error('AI recommendations API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        // Admin auth check (supports Bearer token + cookies)
        const { supabase } = await requireAdmin();

        const body = await request.json();
        const { recommendation_id, action, notes } = body;

        // Validate
        if (!recommendation_id || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid request: requires recommendation_id and action (approve/reject)' },
                { status: 400 }
            );
        }

        // Review recommendation
        await ActionDispatcherService.reviewRecommendation(
            recommendation_id,
            action as 'approve' | 'reject',
            notes
        );

        return NextResponse.json({
            success: true,
            message: `Recommendation ${action}ed successfully`,
        });

    } catch (error: any) {
        console.error('Recommendation review error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
