import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ForecastPeriodSchema = z.enum(['daily', 'weekly', 'monthly']);
export const StockoutRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const RecommendationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'ordered']);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Forecast
export const forecastSchema = z.object({
    id: z.string().uuid(),
    part_id: z.string().uuid(),
    store_id: z.string().uuid(),
    forecast_date: z.string(),
    period: ForecastPeriodSchema,
    predicted_quantity: z.number(),
    confidence_score: z.number().nullable(),
    created_at: z.string()
});
export type InventoryForecast = z.infer<typeof forecastSchema>;

// Alert
export const stockoutAlertSchema = z.object({
    id: z.string().uuid(),
    part_id: z.string().uuid(),
    store_id: z.string().uuid(),
    risk_level: StockoutRiskLevelSchema,
    current_stock: z.number(),
    predicted_demand_next_7_days: z.number(),
    predicted_stockout_date: z.string().nullable(),
    is_resolved: z.boolean(),
    created_at: z.string()
});
export type StockoutAlert = z.infer<typeof stockoutAlertSchema>;

// Recommendation
export const procurementRecommendationSchema = z.object({
    id: z.string().uuid(),
    part_id: z.string().uuid(),
    target_store_id: z.string().uuid(),
    recommended_dealer_id: z.string().uuid().nullable(),
    recommended_quantity: z.number(),
    reason: z.string().nullable(),
    status: RecommendationStatusSchema,
    created_at: z.string()
});
export type ProcurementRecommendation = z.infer<typeof procurementRecommendationSchema>;
