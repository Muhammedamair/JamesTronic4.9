import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function isISODate(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function GET(req: Request) {
    const supabase = await createClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
        return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const city_id = url.searchParams.get("city_id") ?? "";
    const day = url.searchParams.get("day") ?? "";
    const category = url.searchParams.get("category"); // optional

    if (!isUuid(city_id) || !isISODate(day)) {
        return NextResponse.json(
            { error: "BAD_REQUEST", hint: "Require city_id(uuid) and day(YYYY-MM-DD)" },
            { status: 400 }
        );
    }

    let q = supabase
        .from("c20_heatmap_points_v1")
        .select("pincode,lat,lng,weight,category,day")
        .eq("city_id", city_id)
        .eq("day", day);

    if (category) q = q.eq("category", category);

    const { data, error } = await q;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
        { success: true, count: data?.length ?? 0, data: data ?? [] },
        { status: 200 }
    );
}
