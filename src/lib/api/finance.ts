import { createClient } from '@/utils/supabase/client';
import {
    Transaction, transactionSchema,
    FinancialSummary, financialSummarySchema,
    FinancialKpi, financialKpiSchema
} from '@/lib/types/finance';
import { z } from 'zod';

const supabase = createClient();

export const financeApi = {

    // =========================================================================
    // READ
    // =========================================================================

    getTransactions: async (limit = 50): Promise<Transaction[]> => {
        const { data, error } = await supabase
            .from('financial_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return z.array(transactionSchema).parse(data);
    },

    getSummaries: async (days = 30): Promise<FinancialSummary[]> => {
        const { data, error } = await supabase
            .from('financial_summaries')
            .select('*')
            .order('summary_date', { ascending: true })
            .limit(days);

        if (error) throw new Error(error.message);
        return z.array(financialSummarySchema).parse(data);
    },

    getKpis: async (): Promise<FinancialKpi> => {
        const { data, error } = await supabase.rpc('rpc_get_financial_kpis');

        if (error) throw new Error(error.message);
        return financialKpiSchema.parse(data);
    },

    // =========================================================================
    // ACTIONS
    // =========================================================================

    syncLedger: async (date: string) => {
        const { error } = await supabase.rpc('rpc_sync_daily_ledger', { p_date: date });
        if (error) throw new Error(error.message);
    }
};
