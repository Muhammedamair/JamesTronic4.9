import { NextResponse, type NextRequest } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionValidation = await SessionManager.validateSession();
        if (!sessionValidation.valid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: runId } = await params;
        const supabase = await createClientFromRequest();

        // 1. Get Run Details (RLS enforced)
        const { data: run, error: runError } = await supabase
            .from('expansion_scenario_runs')
            .select('*')
            .eq('id', runId)
            .single();

        if (runError || !run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        // 2. If completed, fetch results
        let results: { scores: unknown[]; allocations: unknown[] } = { scores: [], allocations: [] };

        if (run.status === 'completed') {
            const { data: scores } = await supabase
                .from('expansion_location_scores')
                .select(`
                candidate_id,
                score,
                rank,
                explanation,
                candidate:expansion_candidate_locations(id, name, location)
            `)
                .eq('run_id', runId)
                .order('rank', { ascending: true })
                .limit(10);

            const { data: allocations } = await supabase
                .from('service_area_allocations')
                .select('*')
                .eq('run_id', runId);

            results = { scores: scores || [], allocations: allocations || [] };
        }

        return NextResponse.json({
            success: true,
            data: {
                run,
                results
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
