import { NextResponse, type NextRequest } from "next/server";
import { SessionManager } from "@/lib/auth-system/sessionManager";
import { createClientFromRequest } from "@/lib/supabase/server";

function getAppRole(user: any): string | null {
    // Prefer app_metadata.app_role (your JWT shows this is correct)
    return (
        user?.app_metadata?.app_role ??
        user?.user_metadata?.app_role ??
        user?.user_metadata?.role ??
        user?.app_metadata?.role ??
        null
    );
}

export async function GET(request: NextRequest) {
    try {
        // Keep your existing session gate (device lock / app invariants)
        const sessionValidation = await SessionManager.validateSession();
        if (!sessionValidation.valid) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const cityId = searchParams.get("city_id");
        if (!cityId) {
            return NextResponse.json({ error: "Missing city_id" }, { status: 400 });
        }

        const supabase = await createClientFromRequest();

        // Use getUser() (auth-server verified)
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
            return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
        }

        // RLS will enforce city scope; this filter is fine
        const { data, error } = await supabase
            .from("expansion_scenarios")
            .select("id, city_id, name, description, weights, target_candidates, created_by, created_at, updated_at")
            .eq("city_id", cityId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Scenarios List Error:", error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: data ?? [] }, { status: 200 });
    } catch (e) {
        console.error("Scenarios GET Internal Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Keep your existing session gate
        const sessionValidation = await SessionManager.validateSession();
        if (!sessionValidation.valid) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
        }

        const supabase = await createClientFromRequest();

        // ✅ role source of truth: supabase.auth.getUser() (verified)
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
            return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
        }

        const appRole = getAppRole(userData.user);
        const allowed = appRole === "manager" || appRole === "admin" || appRole === "super_admin";
        if (!allowed) {
            return NextResponse.json(
                { error: "Forbidden", debug: { appRole } },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { city_id, name, description, weights, target_candidates } = body ?? {};

        if (!city_id || !name || !weights) {
            return NextResponse.json(
                { error: "Missing required fields (city_id, name, weights)" },
                { status: 400 }
            );
        }

        // target_candidates must be uuid[] or null
        const targets =
            Array.isArray(target_candidates) && target_candidates.length > 0
                ? target_candidates
                : null;

        // NOTE: Do NOT insert "status" unless your table actually has it.
        const { data, error } = await supabase
            .from("expansion_scenarios")
            .insert({
                city_id,
                name,
                description: description ?? null,
                weights,
                target_candidates: targets,
                created_by: userData.user.id,
            })
            .select("id, city_id, name, description, weights, target_candidates, created_by, created_at, updated_at")
            .single();

        if (error) {
            console.error("Create Scenario Error:", error);

            // RLS / permission errors often appear as 42501 or 403-ish behavior
            const msg = (error as any)?.message ?? "Database Error";
            const code = (error as any)?.code;

            if (code === "42501") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            return NextResponse.json({ error: msg }, { status: 400 });
        }

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (e) {
        console.error("Scenarios POST Internal Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
