// C15.1: AI Events Ingestion API
// POST /api/admin/ai-brain/events

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        // Admin auth check (supports Bearer token + cookies)
        const { supabase } = await requireAdmin();

        const body = await request.json();
        const { event_type, entity_type, entity_id, context, payload } = body;

        // Validate required fields
        if (!event_type || !entity_type || !entity_id) {
            return NextResponse.json(
                { error: 'Missing required fields: event_type, entity_type, entity_id' },
                { status: 400 }
            );
        }

        // Insert event (support both context and payload for compatibility)
        const { data: event, error } = await supabase
            .from('ai_events')
            .insert({
                event_type,
                entity_type,
                entity_id,
                context: context || payload || {},
                processed: false,
            })
            .select('id')
            .single();

        if (error) {
            console.error('AI event insertion error:', error);
            return NextResponse.json(
                { error: 'Failed to ingest event', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                event_id: event.id,
                message: 'Event ingested successfully',
            },
            { status: 201 }
        );

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }
        console.error('AI events API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
