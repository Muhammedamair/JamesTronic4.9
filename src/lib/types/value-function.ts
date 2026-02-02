// C15.1: Value Function Scorer
// Implements OV/TV/BV/LGV scoring with trust-axis primacy

export interface ValueScores {
    operational_value: number; // 0-100
    trust_value: number; // 0-100
    brand_value: number; // 0-100
    governance_value: number; // 0-100
    composite_score: number;
}

export interface ScoringContext {
    entity_type: string;
    entity_id: string;
    signals: {
        c12_tickets?: number;
        c14_performance?: number;
        c16_violations?: number;
        c17_behavior?: number;
    };
}

export interface ThresholdConfig {
    trust_value_minimum: number; // Default: 60
    governance_value_minimum: number; // Default: 80
    composite_minimum: number; // Default: 70
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
    trust_value_minimum: 60,
    governance_value_minimum: 80,
    composite_minimum: 70,
};

/**
 * Value Function Weights
 * Trust Value (TV) is PRIMARY - 40% weight
 */
export const VALUE_WEIGHTS = {
    trust: 0.4,
    operational: 0.3,
    brand: 0.2,
    governance: 0.1,
};
