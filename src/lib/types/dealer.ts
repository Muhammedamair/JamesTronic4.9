import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const DealerStatusSchema = z.enum(['active', 'inactive', 'pending_kyc', 'suspended']);
export type DealerStatus = z.infer<typeof DealerStatusSchema>;

export const PartRequestStatusSchema = z.enum([
    'pending_approval',
    'open_for_quotes',
    'quote_received',
    'ordered',
    'in_transit',
    'delivered',
    'fulfilled',
    'cancelled'
]);
export type PartRequestStatus = z.infer<typeof PartRequestStatusSchema>;

export const StockStatusSchema = z.enum(['in_stock', 'can_procure', 'out_of_stock']);
export type StockStatus = z.infer<typeof StockStatusSchema>;

export const OrderStatusSchema = z.enum([
    'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const DealerAlertTypeSchema = z.enum([
    'quality_issue', 'delayed_delivery', 'pricing_variance',
    'fraud_suspected', 'low_score', 'warranty_claim', 'compliance_issue'
]);
export type DealerAlertType = z.infer<typeof DealerAlertTypeSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Dealer
export const dealerSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    contact_name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    gst_number: z.string().nullable(),
    address_line1: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    pincode: z.string().nullable(),
    status: DealerStatusSchema,
    kyc_verified_at: z.string().nullable(),
    notes: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string()
});
export type Dealer = z.infer<typeof dealerSchema>;

// Dealer Zone
export const dealerZoneSchema = z.object({
    id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    city: z.string(),
    pincodes: z.array(z.string()).nullable(),
    is_primary: z.boolean(),
    created_at: z.string()
});
export type DealerZone = z.infer<typeof dealerZoneSchema>;

// Part Request
export const partRequestSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    requested_by: z.string().uuid(),
    appliance_category: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    part_description: z.string(),
    specifications: z.record(z.string(), z.unknown()).nullable(),
    quantity: z.number(),
    urgency: z.string(),
    status: PartRequestStatusSchema,
    approved_by: z.string().uuid().nullable(),
    approved_at: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type PartRequest = z.infer<typeof partRequestSchema>;

// Dealer Quote
export const dealerQuoteSchema = z.object({
    id: z.string().uuid(),
    part_request_id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    price_per_unit: z.number(),
    gst_percentage: z.number(),
    total_price: z.number(),
    stock_status: StockStatusSchema,
    lead_time_hours: z.number().nullable(),
    warranty_months: z.number(),
    conditions: z.string().nullable(),
    is_selected: z.boolean(),
    quoted_at: z.string(),
    expires_at: z.string().nullable(),
    created_at: z.string()
});
export type DealerQuote = z.infer<typeof dealerQuoteSchema>;

// Part Order
export const partOrderSchema = z.object({
    id: z.string().uuid(),
    quote_id: z.string().uuid(),
    part_request_id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    order_status: OrderStatusSchema,
    ordered_by: z.string().uuid(),
    ordered_at: z.string(),
    expected_delivery_at: z.string().nullable(),
    actual_delivery_at: z.string().nullable(),
    tracking_id: z.string().nullable(),
    delivery_notes: z.string().nullable().optional(),
    received_condition: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type PartOrder = z.infer<typeof partOrderSchema>;

// Dealer Event Fact (Flight Recorder)
export const dealerEventFactSchema = z.object({
    id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    event_type: z.string(),
    context_type: z.string(),
    context_id: z.string().uuid().nullable(),
    occurred_at: z.string(),
    payload: z.record(z.string(), z.unknown()).nullable(),
    created_at: z.string()
});
export type DealerEventFact = z.infer<typeof dealerEventFactSchema>;

// Dealer Score Snapshot (V1 Explainable Score)
export const dealerScoreSnapshotSchema = z.object({
    id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    window_days: z.number(),
    computed_at: z.string(),
    reliability_score: z.number().nullable(),
    confidence_score: z.number().nullable(),
    primary_reason: z.string().nullable(),
    contributing_factors: z.array(z.string()).nullable(),
    operational_value: z.number().nullable(),
    trust_value: z.number().nullable(),
    business_value: z.number().nullable(),
    learning_value: z.number().nullable(),
    metrics_snapshot: z.record(z.string(), z.unknown()).nullable(),
    created_at: z.string()
});
export type DealerScoreSnapshot = z.infer<typeof dealerScoreSnapshotSchema>;

// Dealer Alert
export const dealerAlertSchema = z.object({
    id: z.string().uuid(),
    dealer_id: z.string().uuid(),
    alert_type: DealerAlertTypeSchema,
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string(),
    description: z.string().nullable(),
    is_acknowledged: z.boolean(),
    created_at: z.string()
});
export type DealerAlert = z.infer<typeof dealerAlertSchema>;

// Dashboard Summary Interface
export interface DealerDashboardSummary {
    dealer_id: string;
    dealer_name: string;
    city: string | null;
    reliability_score: number | null;
    confidence_score: number | null;
    trust_value: number | null;
    trend: string | null;
    primary_reason: string | null;
    last_computed_at: string | null;
}


