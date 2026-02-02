import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const city_id = searchParams.get('city_id');
    const service_code = searchParams.get('service_code');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
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

    try {
        let query = supabase
            .from('pricing_base_rates')
            .select(`
                *,
                pricing_service_catalog!inner (
                    description,
                    category,
                    subcategory,
                    size_band
                )
            `, { count: 'exact' })
            .is('effective_to', null) // Only active rates
            .order('effective_from', { ascending: false })
            .range(offset, offset + limit - 1);

        if (city_id) query = query.eq('city_id', city_id);
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
