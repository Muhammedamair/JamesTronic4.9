/**
 * POST /api/admin/inventory/reorders/[id]/reject
 * 
 * Server-only route to reject a reorder recommendation.
 * RBAC: admin/manager only
 * Requires: notes (rejection reason)
 * Calls: rpc_reorder_reject
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Missing recommendation ID' },
                { status: 400 }
            );
        }

        // Create authenticated Supabase client
        const supabase = await createClient();

        // Validate session
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized: Authentication required' },
                { status: 401 }
            );
        }

        // RBAC check via profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Unauthorized: Profile not found' },
                { status: 401 }
            );
        }

        const allowedRoles = ['admin', 'manager'];
        if (!allowedRoles.includes(profile.role)) {
            return NextResponse.json(
                { error: 'Forbidden: Requires admin or manager role' },
                { status: 403 }
            );
        }

        // Parse required notes from request body
        let notes: string;
        try {
            const body = await request.json();
            notes = body.notes;
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body: JSON required' },
                { status: 400 }
            );
        }

        if (!notes || typeof notes !== 'string' || notes.trim() === '') {
            return NextResponse.json(
                { error: 'Rejection requires a notes field with the reason' },
                { status: 400 }
            );
        }

        // Call the RPC
        const { data, error } = await supabase.rpc('rpc_reorder_reject', {
            p_recommendation_id: id,
            p_notes: notes.trim()
        });

        if (error) {
            console.error('RPC error:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(data, { status: 200 });

    } catch (err: any) {
        console.error('Reject route error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
