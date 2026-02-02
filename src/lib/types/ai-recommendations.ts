// C15.1: AI Recommendations Types

export interface AiRecommendation {
    id: string;
    created_at: string;
    recommendation_type: string;
    entity_type?: string;
    entity_id?: string;
    title: string;
    description: string;
    rationale?: string;
    confidence_score: number; // 0.00-1.00
    urgency: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    context?: Record<string, any>;
}

export interface RecommendationRequest {
    recommendation_type: string;
    entity_type?: string;
    entity_id?: string;
    title: string;
    description: string;
    rationale?: string;
    confidence_score: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, any>;
}

export interface RecommendationReview {
    recommendation_id: string;
    action: 'approve' | 'reject';
    notes?: string;
}
