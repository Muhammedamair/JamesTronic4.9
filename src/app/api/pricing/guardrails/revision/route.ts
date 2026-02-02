import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { pricingEngineDb } from '@/lib/pricing/engine-db'; // Service role for transaction

export async function POST(request: Request) {
    const cookieStore = await cookies();

    // 1. Auth Check
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user;
    const {
        city_id, service_code,
        min_total, max_total,
        max_discount_pct, max_surge_pct, floor_margin_pct,
        reason, confirm_text
        // effective_from ignored for safety - we force immediate revision
    } = await request.json();

    // 2. Input Validation
    if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    if (confirm_text?.trim() !== service_code) {
        return NextResponse.json({ error: `Confirmation mismatch. Type "${service_code}" to confirm.` }, { status: 400 });
    }
    if (Number(min_total) > Number(max_total)) {
        return NextResponse.json({ error: 'Min Total cannot be greater than Max Total' }, { status: 400 });
    }
    // Range Validation
    const surge = Number(max_surge_pct);
    const margin = Number(floor_margin_pct);
    const minT = Number(min_total);
    const maxT = Number(max_total);

    if (minT < 0 || maxT < 0) return NextResponse.json({ error: 'Totals must be >= 0' }, { status: 400 });
    if (surge < 0 || surge > 300) return NextResponse.json({ error: 'Surge % must be 0-300' }, { status: 400 });
    if (margin < 0 || margin > 100) return NextResponse.json({ error: 'Floor margin % must be 0-100' }, { status: 400 });
    if (Number(max_discount_pct) < 0 || Number(max_discount_pct) > 100) {
        return NextResponse.json({ error: 'Discount % must be 0-100' }, { status: 400 });
    }

    // 3. City Access Check
    const userRole = user.app_metadata?.app_role;
    const userCity = user.app_metadata?.city_id;

    if (userRole === 'manager') {
        if (!userCity || (userCity !== city_id)) {
            return NextResponse.json({ error: 'Manager restricted to assigned city' }, { status: 403 });
        }
    } else if (['admin', 'super_admin'].includes(userRole)) {
        // Allow
    } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // 4. Transaction via Service Role

        // A. Fetch current active row
        const { data: currentRows, error: fetchError } = await pricingEngineDb
            .from('pricing_guardrails')
            .select('*')
            .eq('city_id', city_id)
            .eq('service_code', service_code)
            .is('effective_to', null);

        const previousState = currentRows?.[0] || null;

        // B. End-date current active row
        const effectiveDate = new Date().toISOString(); // Imposed Immediate Effect

        const { error: updateError } = await pricingEngineDb
            .from('pricing_guardrails')
            .update({ effective_to: effectiveDate })
            .eq('city_id', city_id)
            .eq('service_code', service_code)
            .is('effective_to', null);

        if (updateError) throw updateError;

        // C. Insert new row
        const { data: newGuardrail, error: insertError } = await pricingEngineDb
            .from('pricing_guardrails')
            .insert({
                city_id,
                service_code,
                min_total: Math.max(0, minT),
                max_total: Math.max(0, maxT),
                max_discount_pct: Number(max_discount_pct),
                max_surge_pct: surge,
                floor_margin_pct: margin,
                is_enabled: previousState?.is_enabled ?? true, // Persist or Default
                effective_from: effectiveDate,
                effective_to: null
            })
            .select()
            .single();

        if (insertError) {
            // Handle Unique Conflict explicitly
            if (insertError.code === '23505') {
                return NextResponse.json({ error: 'Conflict: Another revision was just created. Please refresh.' }, { status: 409 });
            }
            throw insertError;
        }

        // D. Audit Log
        await pricingEngineDb.from('pricing_audit_log').insert({
            event_type: 'GUARDRAIL_REVISION_CREATED',
            city_id,
            actor_id: user.id,
            actor_role: userRole,
            payload: {
                revision_id: newGuardrail.id,
                service_code,
                reason,
                before: previousState,
                after: newGuardrail
            },
            explanation: reason
        });

        return NextResponse.json({ success: true, guardrail: newGuardrail });

    } catch (e: any) {
        console.error('Guardrail Revision Error:', e);
        return NextResponse.json({ error: e.message || 'Revision failed' }, { status: 500 });
    }
}
