import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/workforce/scores
 * Fetches workforce behaviour scores for admin dashboard.
 * Query params: user_id (optional), start_date, end_date
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify admin/staff role
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!profile || !['admin', 'staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        const startDate = searchParams.get('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

        // Build query
        let query = supabase
            .from('workforce_behaviour_scores')
            .select(`
        *,
        profiles:user_id (
          full_name,
          role
        )
      `)
            .gte('score_date', startDate)
            .lte('score_date', endDate)
            .order('score_date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: scores, error } = await query;

        if (error) {
            console.error('Error fetching workforce scores:', error);
            return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
        }

        return NextResponse.json(scores);
    } catch (error) {
        console.error('Unexpected error in workforce scores API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
