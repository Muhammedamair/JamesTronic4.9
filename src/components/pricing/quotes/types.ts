export interface Quote {
    id: string;
    quote_key: string;
    city_id: string;
    customer_id?: string | null;
    ticket_id?: string | null;
    service_code: string;

    // Amounts
    labor_amount: number;
    parts_amount: number;
    parts_cost: number;
    transport_amount: number;
    diagnostic_amount: number;
    urgency_surcharge: number;
    complexity_surcharge: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;

    // Snapshot refs
    ruleset_id: string;
    ruleset_version: string;
    base_rate_ref: Record<string, unknown>;
    guardrail_ref: Record<string, unknown>;
    breakdown: {
        labor: number;
        parts: number;
        transport: number;
        diagnostic: number;
        urgency_surcharge: number;
        complexity_surcharge: number;
        subtotal_before_guardrails: number;
    };

    // Metadata
    reason_codes: string[];
    customer_explanation?: string | null;

    // State
    status: 'pending' | 'accepted' | 'expired' | 'blocked' | 'anomaly';
    expires_at: string;
    accepted_at?: string | null;
    accepted_by?: string | null;

    // Audit
    created_at: string;
    created_by: string;
}

export interface CreateQuotePayload {
    city_id: string;
    service_code: string;
    customer_id?: string;
    ticket_id?: string;
    urgency: 'same_day' | 'next_day' | 'standard';
    complexity: 'simple' | 'standard' | 'complex';
    parts_cost?: number;
}

export interface CreateQuoteResponse {
    quote_id: string;
    total_amount: number;
    breakdown: Quote['breakdown'];
    expires_at: string;
    reason_codes: string[];
    idempotent: boolean;
}

export interface AcceptQuoteResponse {
    success: boolean;
    quote_id: string;
    accepted_at: string;
}
