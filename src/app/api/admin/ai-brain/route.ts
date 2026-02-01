import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';
import { AiOrchestrator } from '@/lib/services/ai-orchestrator';

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await requireAdmin();

        // Fetch Real Live Metrics
        const today = new Date().toISOString().split('T')[0];

        // 1. Active Tickets (Status not closed/cancelled)
        const { count: activeTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .not('status', 'in', '("closed","cancelled")');

        // 2. SLA Breaches (Count from customer_sla_snapshot where breach=true)
        // Adjust column name based on actual schema if needed
        const { count: slaBreaches } = await supabase
            .from('customer_sla_snapshot')
            .select('*', { count: 'exact', head: true })
            .eq('is_breached', true);

        // 3. Revenue Today (Sum settlements processed today)
        const { data: revenueData } = await supabase
            .from('settlements')
            .select('net_payout')
            .gte('processed_at', `${today}T00:00:00`)
            .lte('processed_at', `${today}T23:59:59`);

        const revenueToday = revenueData?.reduce((sum, item) => sum + (item.net_payout || 0), 0) || 0;

        const metrics = {
            active_tickets: activeTickets || 0,
            sla_breaches: slaBreaches || 0,
            revenue_today: revenueToday,
            critical_alerts: [] // Todo: Implement alert logic
        };

        const response = await AiOrchestrator.queryBrain({
            context: 'admin_cockpit',
            user_role: 'admin', // Enforced by Orchestrator too
            metrics_snapshot: metrics,
            question: "Generate Daily Briefing"
        });

        return NextResponse.json(response);

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error("API Error in AI Brain:", error);
        return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
    }
}
