import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

export async function GET() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? env("SUPABASE_URL"),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env("SUPABASE_ANON_KEY"),
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // ignore if runtime disallows setting cookies in some contexts
                    }
                },
            },
        }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
        return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("cities")
        .select("id,name,state,country,active,timezone")
        .eq("active", true)
        .order("name");

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ cities: data ?? [] }, { status: 200 });
}
