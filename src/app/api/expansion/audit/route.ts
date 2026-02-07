import { NextResponse, type NextRequest } from "next/server";
import { SessionManager } from "@/lib/auth-system/sessionManager";
import { createClientFromRequest } from "@/lib/supabase/server";
import { z } from "zod";

// ============================================================================
// Request Validation
// ============================================================================

const AuditQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    city_id: z.string().uuid().optional(),
    run_id: z.string().uuid().optional(),
    event_type: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});

// ============================================================================
// Helper: Extract app role from user
// ============================================================================

function getAppRole(user: any): string | null {
    return (
        user?.app_metadata?.app_role ??
        user?.user_metadata?.app_role ??
        user?.user_metadata?.role ??
        user?.app_metadata?.role ??
        null
    );
}

// ============================================================================
// GET /api/expansion/audit
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        // 1. Initialize Supabase (handles Authorization header automatically)
        const supabase = await createClientFromRequest();
        const { data: userData, error: userErr } = await supabase.auth.getUser();

        // 2. Check SessionManager (cookies) as alternative
        const sessionValidation = await SessionManager.validateSession();

        // 3. Must have EITHER valid bearer token OR valid session cookie
        const isAuthenticated = (!userErr && userData?.user) || sessionValidation.valid;

        if (!isAuthenticated) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
        }

        const user = userData?.user || (sessionValidation.session as any)?.user; // Note: validateSession returns session data, not user object

        // If we only have sessionValidation, we might need to get user data if not in session
        const actualUser = userData?.user || (await supabase.auth.admin.getUserById((sessionValidation.session as any).userId)).data.user;

        if (!actualUser) {
            return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
        }

        // 4. Role check: Manager, Admin, or Super-Admin only
        const appRole = getAppRole(actualUser);
        const allowed = appRole === "manager" || appRole === "admin" || appRole === "super_admin";
        if (!allowed) {
            return NextResponse.json(
                { error: "Forbidden", code: "ROLE_DENIED", debug: { appRole } },
                { status: 403 }
            );
        }

        // 5. Parse and validate query params
        const { searchParams } = new URL(request.url);
        const queryResult = AuditQuerySchema.safeParse({
            page: searchParams.get("page") ?? undefined,
            limit: searchParams.get("limit") ?? undefined,
            city_id: searchParams.get("city_id") ?? undefined,
            run_id: searchParams.get("run_id") ?? undefined,
            event_type: searchParams.get("event_type") ?? undefined,
            from: searchParams.get("from") ?? undefined,
            to: searchParams.get("to") ?? undefined,
        });

        if (!queryResult.success) {
            return NextResponse.json(
                { error: "Invalid query parameters", details: queryResult.error.flatten() },
                { status: 400 }
            );
        }

        const { page, limit, city_id, run_id, event_type, from, to } = queryResult.data;


        // 6. Build query with RLS (city-scoped for managers via RLS policy)
        let query = supabase
            .from("expansion_audit_log")
            .select("id, ai_module, event_type, city_id, payload, user_id, role, details, created_at", { count: "exact" })
            .order("created_at", { ascending: false });

        // Apply filters
        if (city_id) {
            query = query.eq("city_id", city_id);
        }
        if (run_id) {
            // Filter by run_id in payload
            query = query.contains("payload", { run_id });
        }
        if (event_type) {
            query = query.eq("event_type", event_type);
        }
        if (from) {
            query = query.gte("created_at", from);
        }
        if (to) {
            query = query.lte("created_at", to);
        }

        // Pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        // 7. Execute query
        const { data, error, count } = await query;

        if (error) {
            console.error("Audit API Error:", error);

            // RLS permission errors
            if ((error as any)?.code === "42501") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // 8. Build paginated response
        const total = count ?? 0;
        const hasMore = offset + limit < total;

        return NextResponse.json({
            success: true,
            data: data ?? [],
            pagination: {
                page,
                limit,
                total,
                hasMore
            }
        }, { status: 200 });

    } catch (e) {
        console.error("Audit GET Internal Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
