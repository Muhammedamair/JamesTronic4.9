// Pricing types for client-side API usage

export interface BaseRate {
    id: string;
    city_id: string;
    service_code: string;
    labor_base: number;
    diagnostic_fee: number;
    transport_base: number;
    parts_markup_pct: number;
    effective_from: string;
    effective_to: string | null;
    is_current: boolean;
    created_at: string;
    created_by: string;
    reason?: string;
}

export interface Guardrail {
    id: string;
    city_id: string;
    min_quote: number;
    max_quote: number;
    floor_margin_pct: number;
    cap_margin_pct: number;
    version: number;
    effective_from: string;
    effective_to: string | null;
    is_current: boolean;
    created_at: string;
    created_by: string;
    reason?: string;
}

export interface Ruleset {
    id: string;
    name: string;
    version: string;
    definition: Record<string, unknown>;
    is_active: boolean;
    activated_at: string | null;
    activated_by: string | null;
    created_at: string;
    created_by: string;
}
