import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ForecastConfidenceSchema = z.enum(['low', 'medium', 'high', 'very_high']);
export type ForecastConfidence = z.infer<typeof ForecastConfidenceSchema>;

export const AlertPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AlertPriority = z.infer<typeof AlertPrioritySchema>;

export const ForecastHorizonSchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly']);
export type ForecastHorizon = z.infer<typeof ForecastHorizonSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Demand Forecast
export const demandForecastSchema = z.object({
    id: z.string().uuid(),
    part_category: z.string(),
    brand: z.string().nullable(),
    city: z.string().nullable(),
    forecast_date: z.string(),
    horizon: ForecastHorizonSchema,
    predicted_demand: z.number(),
    confidence: ForecastConfidenceSchema,
    confidence_score: z.number(),
    historical_avg: z.number().nullable(),
    seasonal_factor: z.number(),
    actual_demand: z.number().nullable(),
    forecast_error: z.number().nullable(),
    created_at: z.string()
});
export type DemandForecast = z.infer<typeof demandForecastSchema>;

// Safety Stock Level
export const safetyStockLevelSchema = z.object({
    id: z.string().uuid(),
    part_category: z.string(),
    brand: z.string().nullable(),
    city: z.string().nullable(),
    current_stock: z.number(),
    safety_stock: z.number(),
    reorder_point: z.number(),
    max_stock: z.number(),
    avg_daily_demand: z.number(),
    lead_time_days: z.number(),
    service_level_target: z.number(),
    last_calculated_at: z.string(),
    created_at: z.string(),
    updated_at: z.string()
});
export type SafetyStockLevel = z.infer<typeof safetyStockLevelSchema>;

// Inventory Turnover Metric
export const turnoverMetricSchema = z.object({
    id: z.string().uuid(),
    part_category: z.string(),
    city: z.string().nullable(),
    metric_date: z.string(),
    turnover_rate: z.number().nullable(),
    days_on_hand: z.number().nullable(),
    fill_rate: z.number().nullable(),
    stockout_days: z.number(),
    created_at: z.string()
});
export type TurnoverMetric = z.infer<typeof turnoverMetricSchema>;

// Emergency Stock Trigger
export const emergencyTriggerSchema = z.object({
    id: z.string().uuid(),
    part_category: z.string(),
    brand: z.string().nullable(),
    city: z.string().nullable(),
    current_stock: z.number(),
    safety_stock: z.number(),
    shortfall: z.number(),
    priority: AlertPrioritySchema,
    is_resolved: z.boolean(),
    resolved_at: z.string().nullable(),
    suggested_order_qty: z.number().nullable(),
    triggered_at: z.string(),
    created_at: z.string()
});
export type EmergencyTrigger = z.infer<typeof emergencyTriggerSchema>;

// Seasonal Pattern
export const seasonalPatternSchema = z.object({
    id: z.string().uuid(),
    part_category: z.string(),
    month: z.number(),
    demand_index: z.number(),
    confidence: ForecastConfidenceSchema,
    sample_size: z.number(),
    created_at: z.string()
});
export type SeasonalPattern = z.infer<typeof seasonalPatternSchema>;
