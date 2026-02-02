import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { SessionManager } from "@/lib/auth-system/sessionManager";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    // What our app thinks (SessionManager)
    const sessionValidation = await SessionManager.validateSession().catch(() => ({
        valid: false,
        session: null,
    }));

    // What Supabase Auth says (real user, app_metadata)
    const supabase = await createClientFromRequest();
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    const app = (user?.app_metadata ?? {}) as any;
    const meta = (user?.user_metadata ?? {}) as any;

    const body = {
        ok: !!user && !error,
        sessionManager: sessionValidation?.valid
            ? {
                role: sessionValidation.session?.role ?? null,
                userId: sessionValidation.session?.userId ?? null,
            }
            : null,
        supabaseAuth: user
            ? {
                id: user.id,
                email: user.email ?? null,
                phone: user.phone ?? null,
            }
            : null,
        claims: user
            ? {
                app_role: app.app_role ?? null, // ✅ THIS is the one we want for C20
                role: app.role ?? null,         // ⚠️ this is currently "customer" in your debug
                city_id: app.city_id ?? null,
                allowed_city_ids: app.allowed_city_ids ?? null,
                user_metadata_role: meta.role ?? null,
            }
            : null,
        error: error?.message ?? null,
    };

    return NextResponse.json(body, {
        status: user ? 200 : 401,
        headers: { "x-c20-route": "debug_whoami_v1" },
    });
}
