import { NextResponse, type NextRequest } from "next/server";
import { SessionManager } from "@/lib/auth-system/sessionManager";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const headers = new Headers({ "x-c20-route": "c20_run_v3" });

    try {
        // 1) Session check (keep existing auth flow)
        const sessionValidation = await SessionManager.validateSession();
        if (!sessionValidation.valid || !sessionValidation.session) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401, headers }
            );
        }

        // 2) Supabase (RLS-safe client from request cookies)
        const supabase = await createClientFromRequest();

        // 3) Authenticated user (server-verified)
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
            return NextResponse.json(
                { error: "UNAUTHENTICATED" },
                { status: 401, headers }
            );
        }

        // 4) Role = source of truth (JWT -> get_my_role())
        // get_my_role() checks app_metadata.app_role first (your case: manager)
        let effectiveRole: string | null = null;

        const roleRpc = await supabase.rpc("get_my_role");
        if (!roleRpc.error && roleRpc.data) {
            effectiveRole = String(roleRpc.data);
        } else {
            // fallback (still okay)
            const am: any = userData.user.app_metadata ?? {};
            const um: any = userData.user.user_metadata ?? {};
            effectiveRole = am.app_role ?? am.role ?? um.role ?? null;
        }

        // 5) Allow manager/admin/super_admin to trigger a pending run
        if (!["manager", "admin", "super_admin"].includes(String(effectiveRole))) {
            return NextResponse.json(
                {
                    error: "Forbidden",
                    debug: {
                        effectiveRole,
                        sessionRole: sessionValidation.session.role,
                    },
                },
                { status: 403, headers }
            );
        }

        const { id: scenarioId } = await ctx.params;
        if (!scenarioId) {
            return NextResponse.json(
                { error: "Missing scenario id" },
                { status: 400, headers }
            );
        }

        // 6) Load scenario (RLS blocks cross-city automatically)
        const { data: scenario, error: sErr } = await supabase
            .from("expansion_scenarios")
            .select("id, city_id")
            .eq("id", scenarioId)
            .single();

        if (sErr || !scenario) {
            // avoid leaking existence across city
            return NextResponse.json({ error: "Not Found" }, { status: 404, headers });
        }

        // 7) Insert pending run (worker executes compute)
        const { data: run, error: rErr } = await supabase
            .from("expansion_scenario_runs")
            .insert({
                scenario_id: scenario.id,
                city_id: scenario.city_id,
                status: "pending",
                created_by: userData.user.id,
            })
            .select("id, scenario_id, city_id, status, created_at")
            .single();

        if (rErr) {
            const msg = String(rErr.message || "");
            if (msg.toLowerCase().includes("row-level security")) {
                return NextResponse.json(
                    { error: "Forbidden", reason: "RLS_INSERT_DENIED" },
                    { status: 403, headers }
                );
            }

            console.error("Run create error:", rErr);
            return NextResponse.json(
                { error: "Database Error", detail: rErr.message },
                { status: 500, headers }
            );
        }

        return NextResponse.json({ success: true, data: run }, { status: 201, headers });
    } catch (e) {
        console.error("Run route error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers });
    }
}

