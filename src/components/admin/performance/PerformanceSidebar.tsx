'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceRecord, performanceAPI } from '@/lib/api/performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

interface PerformanceSidebarProps {
  technicianId?: string;
}

export const PerformanceSidebar: React.FC<PerformanceSidebarProps> = ({ technicianId }) => {
  const [performance, setPerformance] = useState<PerformanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!technicianId) {
      setPerformance(null);
      setLoading(false);
      return;
    }

    const fetchPerformance = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await performanceAPI.getTechnicianPerformance(technicianId);
        setPerformance(data);
      } catch (err) {
        console.error('Error fetching technician performance:', err);
        setError('Failed to fetch performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [technicianId]);

  if (!technicianId) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Technician Performance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-center">
            Select a ticket with an assigned technician to view performance metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Technician Performance</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Technician Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-center py-8">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate SLA percentage
  const totalSLA = (performance?.sla_met || 0) + (performance?.sla_breached || 0);
  const slaPercentage = totalSLA > 0
    ? Math.round(((performance?.sla_met || 0) / totalSLA) * 100)
    : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Technician Performance</CardTitle>
          <Link href={`/app/performance`} passHref>
            <Button variant="outline" size="sm" className="h-8">
              <BarChart3 className="h-4 w-4 mr-1" />
              Details
            </Button>
          </Link>
        </div>
        <div className="text-sm text-gray-500">
          {performance?.full_name || 'Loading...'}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-blue-500 mr-2" />
              <span className="text-sm font-medium">Performance Score</span>
            </div>
            <div className="text-lg font-bold text-blue-600">
              {performance?.score?.toFixed(1) || '0.0'}%
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm font-medium">SLA Met</span>
            </div>
            <div className="text-lg font-bold text-green-600">
              {performance?.sla_met || 0}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm font-medium">SLA Breached</span>
            </div>
            <div className="text-lg font-bold text-red-600">
              {performance?.sla_breached || 0}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-sm font-medium">Avg. Completion</span>
            </div>
            <div className="text-lg font-bold">
              {performance?.avg_completion_time_minutes || 0} min
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-sm mb-1">
              <span>SLA Compliance</span>
              <span>{slaPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  slaPercentage >= 90 ? 'bg-green-500' :
                  slaPercentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${slaPercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Rating</span>
              <span>{(performance?.rating_avg || 0).toFixed(1)}/5</span>
            </div>
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${i < Math.floor(performance?.rating_avg || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};