import { createClient } from '@/utils/supabase/client';
import {
    DemandForecast,
    SafetyStockLevel,
    TurnoverMetric,
    EmergencyTrigger,
    SeasonalPattern,
    demandForecastSchema,
    safetyStockLevelSchema,
    turnoverMetricSchema,
    emergencyTriggerSchema,
    seasonalPatternSchema
} from '@/lib/types/inventory';
import { z } from 'zod';

const supabase = createClient();

// =========================================================================
// C19 REORDER RECOMMENDATION TYPE
// =========================================================================

export interface ReorderRecommendation {
    id: string;
    location_id: string;
    part_id: string;
    recommended_qty: number;
    target_days_cover: number;
    stockout_risk_score: number;
    suggested_dealer_id: string | null;
    evidence: Record<string, any>;
    value_score: Record<string, any>;
    status: 'proposed' | 'approved' | 'rejected' | 'ordered' | 'received' | 'cancelled';
    approved_by: string | null;
    approved_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string | null;
}

export const inventoryApi = {

    // =========================================================================
    // DEMAND FORECASTS
    // =========================================================================

    getDemandForecasts: async (partCategory?: string, city?: string): Promise<DemandForecast[]> => {
        let query = supabase
            .from('parts_demand_forecasts')
            .select('*')
            .order('forecast_date', { ascending: false });

        if (partCategory) query = query.eq('part_category', partCategory);
        if (city) query = query.eq('city', city);

        const { data, error } = await query.limit(50);
        if (error) throw new Error(error.message);
        return z.array(demandForecastSchema).parse(data);
    },

    generateForecast: async (partCategory: string, city?: string, horizonDays = 7): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_generate_demand_forecast', {
            p_part_category: partCategory,
            p_city: city || null,
            p_horizon_days: horizonDays
        });
        if (error) throw new Error(error.message);
        return data;
    },

    // =========================================================================
    // SAFETY STOCK
    // =========================================================================

    getSafetyStockLevels: async (city?: string): Promise<SafetyStockLevel[]> => {
        let query = supabase.from('safety_stock_levels').select('*');
        if (city) query = query.eq('city', city);

        const { data, error } = await query.order('part_category');
        if (error) throw new Error(error.message);
        return z.array(safetyStockLevelSchema).parse(data);
    },

    calculateSafetyStock: async (partCategory: string, city?: string): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_safety_stock', {
            p_part_category: partCategory,
            p_city: city || null
        });
        if (error) throw new Error(error.message);
        return data;
    },

    updateCurrentStock: async (id: string, currentStock: number): Promise<SafetyStockLevel> => {
        const { data, error } = await supabase
            .from('safety_stock_levels')
            .update({ current_stock: currentStock })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return safetyStockLevelSchema.parse(data);
    },

    // =========================================================================
    // EMERGENCY ALERTS
    // =========================================================================

    getEmergencyAlerts: async (unresolvedOnly = true): Promise<EmergencyTrigger[]> => {
        let query = supabase
            .from('emergency_stock_triggers')
            .select('*')
            .order('triggered_at', { ascending: false });

        if (unresolvedOnly) query = query.eq('is_resolved', false);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return z.array(emergencyTriggerSchema).parse(data);
    },

    checkEmergencyStock: async (): Promise<number> => {
        const { data, error } = await supabase.rpc('rpc_check_emergency_stock');
        if (error) throw new Error(error.message);
        return data as number;
    },

    resolveEmergencyAlert: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('emergency_stock_triggers')
            .update({ is_resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    // =========================================================================
    // TURNOVER METRICS
    // =========================================================================

    getTurnoverMetrics: async (city?: string): Promise<TurnoverMetric[]> => {
        let query = supabase.from('inventory_turnover_metrics').select('*');
        if (city) query = query.eq('city', city);

        const { data, error } = await query.order('metric_date', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(turnoverMetricSchema).parse(data);
    },

    // =========================================================================
    // SEASONAL PATTERNS
    // =========================================================================

    getSeasonalPatterns: async (partCategory?: string): Promise<SeasonalPattern[]> => {
        let query = supabase.from('seasonal_patterns').select('*');
        if (partCategory) query = query.eq('part_category', partCategory);

        const { data, error } = await query.order('month');
        if (error) throw new Error(error.message);
        return z.array(seasonalPatternSchema).parse(data);
    },

    upsertSeasonalPattern: async (
        partCategory: string,
        month: number,
        demandIndex: number
    ): Promise<SeasonalPattern> => {
        const { data, error } = await supabase
            .from('seasonal_patterns')
            .upsert({
                part_category: partCategory,
                month,
                demand_index: demandIndex
            }, { onConflict: 'part_category,month' })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return seasonalPatternSchema.parse(data);
    },

    // =========================================================================
    // C19 REORDER RECOMMENDATIONS (Server Route Mutations)
    // =========================================================================

    /**
     * Fetch reorder recommendations with optional status filter
     */
    getReorders: async (status?: string): Promise<{ data: ReorderRecommendation[] | null; error: string | null }> => {
        try {
            let query = supabase
                .from('reorder_recommendations')
                .select('*')
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query.limit(100);
            if (error) return { data: null, error: error.message };
            return { data: data as ReorderRecommendation[], error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    },

    /**
     * Approve a reorder recommendation (via server route)
     * @param recommendationId - UUID of the recommendation
     * @param notes - Optional approval notes
     */
    approveReorder: async (recommendationId: string, notes?: string): Promise<{ success: boolean; new_status: string }> => {
        const response = await fetch(`/api/admin/inventory/reorders/${recommendationId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to approve reorder');
        }

        return response.json();
    },

    /**
     * Reject a reorder recommendation (via server route)
     * @param recommendationId - UUID of the recommendation
     * @param notes - Required rejection reason
     */
    rejectReorder: async (recommendationId: string, notes: string): Promise<{ success: boolean; new_status: string }> => {
        if (!notes || notes.trim() === '') {
            throw new Error('Rejection requires a notes field with the reason');
        }

        const response = await fetch(`/api/admin/inventory/reorders/${recommendationId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reject reorder');
        }

        return response.json();
    },

    // =========================================================================
    // C19 INVENTORY ALERTS (Server Route Mutations)
    // =========================================================================

    /**
     * Resolve an inventory alert (via server route)
     * @param alertId - UUID of the alert
     * @param resolutionNote - Required resolution description
     */
    resolveAlert: async (alertId: string, resolutionNote: string): Promise<{ success: boolean; resolved_at: string }> => {
        if (!resolutionNote || resolutionNote.trim() === '') {
            throw new Error('Resolution requires a resolutionNote field');
        }

        const response = await fetch(`/api/admin/inventory/alerts/${alertId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolutionNote })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to resolve alert');
        }

        return response.json();
    },

    /**
     * Trigger full forecast regeneration (Server Route)
     * Computes demand rollups, forecast snapshots, and reorder recommendations.
     */
    generateForecasts: async (): Promise<{ success: boolean; message: string }> => {
        const response = await fetch('/api/admin/inventory/generate-forecasts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate forecasts');
        }

        return response.json();
    }
};
