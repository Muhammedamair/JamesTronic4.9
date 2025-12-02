'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceTable } from '@/components/admin/performance/PerformanceTable';
import { SLABreachList } from '@/components/admin/performance/SLABreachList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { performanceAPI } from '@/lib/api/performance';

const PerformanceDashboardPage = () => {
  const [topTechnicians, setTopTechnicians] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalTechnicians: 0,
    avgScore: 0,
    totalSLAMet: 0,
    totalSLABreached: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch summary data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all performances to calculate summary stats
        const performances = await performanceAPI.getPerformances();

        // Calculate summary stats
        const totalTechnicians = performances.length;
        const avgScore = totalTechnicians > 0
          ? performances.reduce((sum, perf) => sum + (perf.score || 0), 0) / totalTechnicians
          : 0;
        const totalSLAMet = performances.reduce((sum, perf) => sum + (perf.sla_met || 0), 0);
        const totalSLABreached = performances.reduce((sum, perf) => sum + (perf.sla_breached || 0), 0);

        setSummaryStats({
          totalTechnicians,
          avgScore: parseFloat(avgScore.toFixed(2)),
          totalSLAMet,
          totalSLABreached
        });

        // Get top 5 technicians by score
        const sortedPerformances = [...performances].sort((a, b) =>
          (b.score || 0) - (a.score || 0)
        );
        setTopTechnicians(sortedPerformances.slice(0, 5));
      } catch (error) {
        console.error('Error fetching performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Technician Performance</h1>
        <Badge variant="outline">Admin Only</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Technicians</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalTechnicians}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Met</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalSLAMet}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Breached</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalSLABreached}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Technicians */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topTechnicians.map((tech, index) => (
                  <div key={tech.technician_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{tech.full_name}</div>
                        <div className="text-sm text-gray-500">{tech.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-lg font-bold">{tech.score?.toFixed(1)}%</div>
                      <div className="text-sm">
                        <span className="font-medium">{tech.jobs_completed || 0}</span> jobs
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-green-600">{tech.sla_met || 0}</span> |
                        <span className="font-medium text-red-600"> {tech.sla_breached || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>SLA Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Overall SLA Compliance</span>
                    <span className="font-medium">
                      {summaryStats.totalSLAMet + summaryStats.totalSLABreached > 0
                        ? Math.round((summaryStats.totalSLAMet / (summaryStats.totalSLAMet + summaryStats.totalSLABreached)) * 100)
                        : 100}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full"
                      style={{
                        width: `${summaryStats.totalSLAMet + summaryStats.totalSLABreached > 0
                          ? (summaryStats.totalSLAMet / (summaryStats.totalSLAMet + summaryStats.totalSLABreached)) * 100
                          : 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{summaryStats.totalSLAMet}</div>
                    <div className="text-sm text-green-600">Met</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">{summaryStats.totalSLABreached}</div>
                    <div className="text-sm text-red-600">Breached</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Technician Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceTable />
        </CardContent>
      </Card>

      {/* SLA Breaches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent SLA Breaches</CardTitle>
        </CardHeader>
        <CardContent>
          <SLABreachList limit={10} />
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboardPage;