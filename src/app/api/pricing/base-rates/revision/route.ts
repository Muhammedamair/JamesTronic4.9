import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { pricingEngineDb } from '@/lib/pricing/engine-db'; // Service role client for transaction

export async function POST(request: Request) {
    const cookieStore = await cookies();

    // 1. Auth Check (Standard RLS check simulation)
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
    const { city_id, service_code, labor_base, diagnostic_fee, transport_base, parts_markup_pct, reason, effective_from } = await request.json();

    if (!reason) return NextResponse.json({ error: 'Reason is required for revision' }, { status: 400 });

    // 2. City Access Check
    const userRole = user.app_metadata?.app_role; // Assuming C20 role logic
    const userCity = user.app_metadata?.city_id;

    if (userRole === 'manager') {
        // Strict city enforcement
        if (!userCity || (userCity !== city_id)) {
            return NextResponse.json({ error: 'Manager restricted to assigned city' }, { status: 403 });
        }
    } else if (['admin', 'super_admin'].includes(userRole)) {
        // Admin allowed
    } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // 3. Transaction via Service Role (pricingEngineDb)
        // Since Supabase REST doesn't expose explicit BEGIN/COMMIT transaction easily without RPC,
        // we simulate it or use an RPC if strict atomicity is needed.
        // For P4.2, we will do sequential ops and rely on 'effective_to IS NULL' constraint to catch races.
        // Better: Use a dedicated RPC 'rpc_c21_create_base_rate_revision' if we were pure backend, 
        // but here we demonstrate the logic. We'll sequence it safely.

        // A. End-date current active row
        // We set effective_to = new_effective_from (or NOW if immediate)
        const effectiveDate = effective_from ? new Date(effective_from).toISOString() : new Date().toISOString();

        const { error: updateError } = await pricingEngineDb
            .from('pricing_base_rates')
            .update({ effective_to: effectiveDate })
            .eq('city_id', city_id)
            .eq('service_code', service_code)
            .is('effective_to', null); // Only close the currently active one

        if (updateError) throw updateError;

        // B. Insert new row
        const { data: newRate, error: insertError } = await pricingEngineDb
            .from('pricing_base_rates')
            .insert({
                city_id,
                service_code,
                labor_base,
                diagnostic_fee,
                transport_base,
                parts_markup_pct,
                effective_from: effectiveDate,
                effective_to: null, // New active
                ruleset_version: 'v1.0.0' // Inherited or passed. We stick to global version for now per discussion.
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // C. Audit Log
        await pricingEngineDb.from('pricing_audit_log').insert({
            event_type: 'BASE_RATE_REVISION_CREATED',
            city_id,
            actor_id: user.id,
            actor_role: userRole,
            payload: {
                revision_id: newRate.id,
                service_code,
                changes: { labor_base, diagnostic_fee, transport_base, parts_markup_pct },
                reason
            },
            explanation: reason
        });

        return NextResponse.json({ success: true, rate: newRate });

    } catch (e: any) {
        console.error('Revision Error:', e);
        // If unique constraint violation on index idx_pricing_base_rates_current_active, 
        // it means we failed to close the old one or race condition.
        return NextResponse.json({ error: e.message || 'Revision failed' }, { status: 500 });
    }
}
