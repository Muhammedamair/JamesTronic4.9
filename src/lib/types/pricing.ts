import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PricingCategorySchema = z.enum([
    'tv_repair', 'ac_repair', 'refrigerator_repair', 'washing_machine_repair',
    'laptop_repair', 'mobile_repair', 'diagnostics', 'transportation',
    'installation', 'warranty', 'other'
]);
export type PricingCategory = z.infer<typeof PricingCategorySchema>;

export const ModifierTypeSchema = z.enum([
    'urgency', 'complexity', 'geographic', 'seasonal', 'surge', 'discount', 'loyalty'
]);
export type ModifierType = z.infer<typeof ModifierTypeSchema>;

export const QuoteStatusSchema = z.enum([
    'draft', 'pending_approval', 'approved', 'sent_to_customer', 'accepted', 'rejected', 'expired'
]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Pricing Rule
export const pricingRuleSchema = z.object({
    id: z.string().uuid(),
    category: PricingCategorySchema,
    name: z.string(),
    description: z.string().nullable(),
    base_diagnostic_fee: z.number(),
    base_labour_per_hour: z.number(),
    base_transport_fee: z.number(),
    min_charge: z.number(),
    part_markup_percentage: z.number(),
    is_active: z.boolean(),
    valid_from: z.string(),
    valid_until: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type PricingRule = z.infer<typeof pricingRuleSchema>;

// Pricing Modifier
export const pricingModifierSchema = z.object({
    id: z.string().uuid(),
    modifier_type: ModifierTypeSchema,
    name: z.string(),
    description: z.string().nullable(),
    multiplier: z.number(),
    applies_to_categories: z.array(PricingCategorySchema).nullable(),
    applies_to_cities: z.array(z.string()).nullable(),
    is_active: z.boolean(),
    priority: z.number(),
    created_at: z.string()
});
export type PricingModifier = z.infer<typeof pricingModifierSchema>;

// Surge Pricing Event
export const surgePricingEventSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    city: z.string().nullable(),
    surge_multiplier: z.number(),
    reason: z.string().nullable(),
    starts_at: z.string(),
    ends_at: z.string(),
    is_active: z.boolean(),
    created_at: z.string()
});
export type SurgePricingEvent = z.infer<typeof surgePricingEventSchema>;

// Price Quote
export const priceQuoteSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    status: QuoteStatusSchema,
    diagnostic_fee: z.number(),
    labour_cost: z.number(),
    labour_hours: z.number(),
    parts_cost: z.number(),
    parts_markup: z.number(),
    transport_fee: z.number(),
    subtotal: z.number(),
    modifiers_applied: z.any(),
    modifiers_total: z.number(),
    discount_amount: z.number(),
    gst_percentage: z.number(),
    gst_amount: z.number(),
    grand_total: z.number(),
    created_at: z.string(),
    updated_at: z.string()
});
export type PriceQuote = z.infer<typeof priceQuoteSchema>;

// SLA Penalty Record
export const slaPenaltyRecordSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    breach_type: z.string(),
    breached_at: z.string(),
    expected_value: z.string(),
    actual_value: z.string(),
    penalty_percentage: z.number(),
    base_amount: z.number(),
    penalty_amount: z.number(),
    compensation_type: z.string(),
    is_applied: z.boolean(),
    created_at: z.string()
});
export type SLAPenaltyRecord = z.infer<typeof slaPenaltyRecordSchema>;
