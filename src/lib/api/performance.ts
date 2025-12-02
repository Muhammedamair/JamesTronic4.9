import { z } from 'zod';

// Zod schemas for validation
export const performanceRecordSchema = z.object({
  id: z.string().uuid().optional(),
  technician_id: z.string().uuid(),
  full_name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  total_jobs: z.number().int().min(0).optional(),
  jobs_completed: z.number().int().min(0).optional(),
  avg_completion_time_minutes: z.number().int().min(0).optional(),
  sla_met: z.number().int().min(0).optional(),
  sla_breached: z.number().int().min(0).optional(),
  rating_avg: z.number().min(0).max(5).optional(),
  score: z.number().min(0).max(100).optional(),
  updated_at: z.string().optional(),
});

export const slaRecordSchema = z.object({
  id: z.string().uuid().optional(),
  technician_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  ticket_summary: z.string().optional(),
  ticket_status: z.string().optional(),
  ticket_created_at: z.string().optional(),
  sla_target_minutes: z.number().int().positive(),
  completion_minutes: z.number().int().nonnegative().optional(),
  sla_met: z.boolean(),
  created_at: z.string().optional(),
});

export type PerformanceRecord = z.infer<typeof performanceRecordSchema>;
export type SLARecord = z.infer<typeof slaRecordSchema>;

// API wrapper functions
export const performanceAPI = {
  // Get all technician performances
  async getPerformances(
    sortBy: string = 'score',
    order: 'asc' | 'desc' = 'desc',
    limit: number = 20,
    offset: number = 0
  ): Promise<PerformanceRecord[]> {
    try {
      const response = await fetch(
        `/api/performance?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access performance data');
        }
        throw new Error(`Failed to fetch performances: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((item: any) => performanceRecordSchema.parse(item));
    } catch (error) {
      console.error('Error fetching performances:', error);
      throw error;
    }
  },

  // Get specific technician's performance
  async getTechnicianPerformance(id: string): Promise<PerformanceRecord> {
    try {
      const response = await fetch(`/api/performance/${id}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access performance data');
        }
        if (response.status === 404) {
          // Return a default performance record if not found
          return {
            id,
            technician_id: id,
            full_name: 'Unknown Technician',
            email: undefined,
            role: undefined,
            total_jobs: 0,
            jobs_completed: 0,
            avg_completion_time_minutes: 0,
            sla_met: 0,
            sla_breached: 0,
            rating_avg: 0,
            score: 0,
            updated_at: undefined,
          };
        }
        throw new Error(`Failed to fetch technician performance: ${response.statusText}`);
      }

      const data = await response.json();
      return performanceRecordSchema.parse(data);
    } catch (error) {
      console.error('Error fetching technician performance:', error);
      throw error;
    }
  },

  // Get technician's SLA history
  async getTechnicianSLAHistory(
    id: string,
    limit: number = 50,
    offset: number = 0,
    startDate?: string,
    endDate?: string,
    slaStatus?: 'met' | 'breached'
  ): Promise<SLARecord[]> {
    try {
      let url = `/api/performance/history/${id}?limit=${limit}&offset=${offset}`;

      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;
      if (slaStatus) url += `&sla_status=${slaStatus}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access performance data');
        }
        throw new Error(`Failed to fetch SLA history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((item: any) => slaRecordSchema.parse(item));
    } catch (error) {
      console.error('Error fetching SLA history:', error);
      throw error;
    }
  },

  // Calculate performance score for a technician
  async calculatePerformanceScore(id: string): Promise<PerformanceRecord> {
    // This would typically call an API endpoint that calculates the score
    // For now, we'll just fetch and return the current performance record
    return await performanceAPI.getTechnicianPerformance(id);
  },

  // Update daily performance for a technician
  async updateDailyPerformance(id: string, data: Partial<PerformanceRecord>): Promise<PerformanceRecord> {
    try {
      const response = await fetch(`/api/performance/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to update performance data');
        }
        throw new Error(`Failed to update daily performance: ${response.statusText}`);
      }

      const result = await response.json();
      return performanceRecordSchema.parse(result);
    } catch (error) {
      console.error('Error updating daily performance:', error);
      throw error;
    }
  },

  // Get monthly performance summary for a technician
  async getMonthlyPerformanceSummary(
    id: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    technician_id: string;
    sla_percentage: number;
    total_records: number;
    sla_met_count: number;
    sla_breached_count: number;
    recent_records: SLARecord[];
  }> {
    try {
      let url = `/api/performance/sla/${id}`;

      if (startDate) url += `?start_date=${startDate}`;
      if (endDate) {
        url += startDate ? `&end_date=${endDate}` : `?end_date=${endDate}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access performance data');
        }
        throw new Error(`Failed to fetch monthly performance summary: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate the response structure
      return {
        technician_id: data.technician_id,
        sla_percentage: data.sla_percentage,
        total_records: data.total_records,
        sla_met_count: data.sla_met_count,
        sla_breached_count: data.sla_breached_count,
        recent_records: data.recent_records.map((item: any) => slaRecordSchema.parse(item)),
      };
    } catch (error) {
      console.error('Error fetching monthly performance summary:', error);
      throw error;
    }
  },
};