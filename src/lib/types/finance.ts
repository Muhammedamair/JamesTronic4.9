import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['revenue', 'expense', 'payout', 'adjustment']);
export const FinancialCategorySchema = z.enum([
    'pickup_fee',
    'repair_labor',
    'parts_sale',
    'parts_purchase',
    'warranty_premium',
    'claim_payout',
    'sla_penalty',
    'marketing',
    'operational_cost',
    'tax',
    'misc'
]);

export const transactionSchema = z.object({
    id: z.string().uuid(),
    type: TransactionTypeSchema,
    category: FinancialCategorySchema,
    amount: z.coerce.number(),
    description: z.string().nullable().optional(),
    branch_id: z.string().uuid().nullable().optional(),
    reference_id: z.string().nullable().optional(),
    metadata: z.any().optional(),
    transaction_date: z.string(),
    created_at: z.string()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const financialSummarySchema = z.object({
    id: z.string().uuid(),
    summary_date: z.string(),
    total_revenue: z.coerce.number(),
    total_expenses: z.coerce.number(),
    gross_margin_percent: z.coerce.number(),
    forecast_revenue: z.coerce.number().nullable().optional(),
    actual_vs_forecast_diff: z.coerce.number().nullable().optional(),
    metadata: z.any().optional()
});

export type FinancialSummary = z.infer<typeof financialSummarySchema>;

export const financialKpiSchema = z.object({
    monthly_revenue: z.number(),
    monthly_expenses: z.number(),
    average_margin: z.number(),
    daily_burn: z.number(),
    health_score: z.number()
});

export type FinancialKpi = z.infer<typeof financialKpiSchema>;
