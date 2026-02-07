import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/workforce/attendance
 * Fetches workforce attendance records.
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
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        // Build query
        let query = supabase
            .from('workforce_attendance')
            .select(`
        *,
        profiles:user_id (
          full_name,
          role
        ),
        shift:shift_id (
          expected_start,
          expected_end
        )
      `)
            .gte('check_in_at', `${date}T00:00:00`)
            .lt('check_in_at', `${date}T23:59:59`)
            .order('check_in_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: attendance, error } = await query;

        if (error) {
            console.error('Error fetching workforce attendance:', error);
            return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
        }

        return NextResponse.json(attendance);
    } catch (error) {
        console.error('Unexpected error in workforce attendance API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
