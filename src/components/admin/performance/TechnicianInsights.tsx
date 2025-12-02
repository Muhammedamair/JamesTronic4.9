'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceRecord, performanceAPI } from '@/lib/api/performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface TechnicianInsightsProps {
  technicianId: string;
}

export const TechnicianInsights: React.FC<TechnicianInsightsProps> = ({ technicianId }) => {
  const [performance, setPerformance] = useState<PerformanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch technician performance
  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const data = await performanceAPI.getTechnicianPerformance(technicianId);
        setPerformance(data);
      } catch (err) {
        console.error('Error fetching technician performance:', err);
        setError('Failed to fetch technician performance');
      } finally {
        setLoading(false);
      }
    };

    if (technicianId) {
      fetchPerformance();
    }
  }, [technicianId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !performance) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'Performance data not available'}
      </div>
    );
  }

  // Calculate SLA percentage
  const totalSLA = (performance.sla_met || 0) + (performance.sla_breached || 0);
  const slaPercentage = totalSLA > 0
    ? Math.round(((performance.sla_met || 0) / totalSLA) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{performance.score?.toFixed(1) || '0.0'}%</div>
            <Progress value={performance.score || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">Jobs Completed</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{performance.jobs_completed || 0}</div>
            <div className="text-sm text-gray-500">out of {performance.total_jobs || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{slaPercentage}%</div>
            <Badge variant={slaPercentage >= 80 ? 'default' : 'destructive'}>
              {performance.sla_met} met, {performance.sla_breached} breached
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{(performance.rating_avg || 0).toFixed(1)}</div>
            <div className="flex items-center mt-1">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${i < Math.floor(performance.rating_avg || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Score</span>
                <span>{performance.score?.toFixed(1) || '0'}%</span>
              </div>
              <Progress value={performance.score || 0} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>SLA Compliance</span>
                <span>{slaPercentage}%</span>
              </div>
              <Progress value={slaPercentage} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Job Completion Rate</span>
                <span>
                  {performance.total_jobs
                    ? `${Math.round(((performance.jobs_completed || 0) / performance.total_jobs) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <Progress
                value={performance.total_jobs
                  ? Math.round(((performance.jobs_completed || 0) / performance.total_jobs) * 100)
                  : 0}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Customer Rating</span>
                <span>{(performance.rating_avg || 0).toFixed(1)}/5</span>
              </div>
              <Progress value={(performance.rating_avg || 0) * 20} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Avg Completion Time</div>
                <div className="text-sm text-gray-500">
                  {performance.avg_completion_time_minutes || 0} minutes
                </div>
              </div>
              <Badge variant="outline">
                {performance.avg_completion_time_minutes && performance.avg_completion_time_minutes < 1440
                  ? 'Fast'
                  : performance.avg_completion_time_minutes && performance.avg_completion_time_minutes < 2880
                    ? 'Average'
                    : 'Needs Improvement'}
              </Badge>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Last Updated</div>
                <div className="text-sm text-gray-500">
                  {performance.updated_at ? new Date(performance.updated_at).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};