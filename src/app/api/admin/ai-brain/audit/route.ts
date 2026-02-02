// C15.13.3: AI Audit Logs API
// GET /api/admin/ai-brain/audit - List audit logs for smoke test and admin tooling

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        // Admin auth check (supports Bearer token + cookies)
        const { supabase } = await requireAdmin();

        // Parse query params
        const { searchParams } = new URL(request.url);
        const limitRaw = Number(searchParams.get('limit') ?? '50');
        const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
        const aiModule = searchParams.get('ai_module');

        // Build query
        let query = supabase
            .from('ai_audit_logs')
            .select('id, ai_module, action_taken, data_points, result_meta, confidence_score, ethical_check_passed, fairness_score, user_id, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (aiModule) {
            query = query.eq('ai_module', aiModule);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Audit logs query error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, logs: data ?? [] });

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }
        console.error('AI audit API error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
