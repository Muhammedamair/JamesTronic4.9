import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const city_id = searchParams.get('city_id');
    const service_code = searchParams.get('service_code');
    const page = parseInt(searchParams.get('page') || '1');
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const offset = (page - 1) * limit;

    const cookieStore = await cookies();
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
    const role = user.app_metadata?.app_role;
    const userCity = user.app_metadata?.city_id;

    const isAdmin = ['admin', 'super_admin'].includes(role);
    const isManager = role === 'manager';

    // City resolution (API enforcement + RLS second line)
    let cityIdToUse: string | null = null;

    if (isManager) {
        if (!userCity) {
            return NextResponse.json({ error: 'Manager has no assigned city' }, { status: 400 });
        }
        cityIdToUse = userCity; // Strictly enforce session city, ignore param
    } else if (isAdmin) {
        // Force city_id for admins until selector UI is ready
        if (!city_id) {
            return NextResponse.json({ error: 'city_id is required for admin query' }, { status: 400 });
        }
        cityIdToUse = city_id;
    } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        let query = supabase
            .from('pricing_guardrails')
            .select(`
                *,
                pricing_service_catalog!inner (
                    description,
                    category,
                    subcategory
                )
            `, { count: 'exact' })
            .is('effective_to', null) // Only active guardrails
            .eq('city_id', cityIdToUse) // Apply resolved city scope
            .order('effective_from', { ascending: false })
            .range(offset, offset + limit - 1);

        if (service_code) query = query.eq('service_code', service_code);

        const { data, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({
            data: data.map((item: any) => ({
                ...item,
                description: item.pricing_service_catalog?.description,
                category: item.pricing_service_catalog?.category
            })),
            pagination: {
                page,
                totalPages: Math.ceil((count || 0) / limit),
                totalItems: count
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
