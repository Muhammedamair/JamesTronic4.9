/**
 * POST /api/admin/inventory/alerts/[id]/resolve
 * 
 * Server-only route to resolve an inventory alert.
 * RBAC: admin/manager only
 * Requires: resolutionNote
 * Calls: rpc_inventory_alert_resolve
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
                { error: 'Missing alert ID' },
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

        // Parse required resolution note from request body
        let resolutionNote: string;
        try {
            const body = await request.json();
            resolutionNote = body.resolutionNote;
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body: JSON required' },
                { status: 400 }
            );
        }

        if (!resolutionNote || typeof resolutionNote !== 'string' || resolutionNote.trim() === '') {
            return NextResponse.json(
                { error: 'Resolution requires a resolutionNote field' },
                { status: 400 }
            );
        }

        // Call the RPC
        const { data, error } = await supabase.rpc('rpc_inventory_alert_resolve', {
            p_alert_id: id,
            p_resolution_note: resolutionNote.trim()
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
        console.error('Resolve alert route error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
