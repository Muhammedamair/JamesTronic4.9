import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const supabase = createClient();

    // 1. Auth & RBAC Check
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await (await supabase)
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    try {
        const adminClient = createAdminClient();

        console.log('Starting forecast generation job triggered by', user.id);

        // 2. Compute Demand History (Rollups)
        const { error: matchError } = await adminClient.rpc('rpc_compute_part_demand', {
            p_days_back: 90
        });
        if (matchError) throw new Error(`Demand computation failed: ${matchError.message}`);

        // 3. Compute Forecast Snapshots
        const { error: forecastError } = await adminClient.rpc('rpc_compute_inventory_forecast');
        if (forecastError) throw new Error(`Forecast computation failed: ${forecastError.message}`);

        // 4. Generate Reorder Recommendations
        const { error: reorderError } = await adminClient.rpc('rpc_generate_reorder_recommendations', {
            p_risk_threshold: 70,
            p_confidence_threshold: 50
        });
        if (reorderError) throw new Error(`Reorder generation failed: ${reorderError.message}`);

        return NextResponse.json({
            success: true,
            message: 'Forecasts and recommendations regenerated successfully'
        });

    } catch (err: any) {
        console.error('Forecast generation error:', err);
        return NextResponse.json({
            error: err.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
