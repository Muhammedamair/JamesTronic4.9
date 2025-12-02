'use client';

import React from 'react';
import { PerformanceRecord } from '@/lib/api/performance';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PerformanceCardProps {
  performance: PerformanceRecord;
}

export const PerformanceCard: React.FC<PerformanceCardProps> = ({ performance }) => {
  // Calculate SLA percentage
  const totalSLA = (performance.sla_met || 0) + (performance.sla_breached || 0);
  const slaPercentage = totalSLA > 0 
    ? Math.round(((performance.sla_met || 0) / totalSLA) * 100) 
    : 100;

  // Determine score badge color
  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Determine SLA badge color
  const getSLABadgeColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100 text-green-800';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <motion.div 
      className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition-colors"
      whileHover={{ backgroundColor: 'rgba(249, 250, 251, 1)' }}
    >
      <div className="md:col-span-3 flex flex-col justify-center">
        <div className="font-medium text-gray-900">{performance.full_name}</div>
        <div className="text-sm text-gray-500">{performance.email}</div>
      </div>
      
      <div className="md:col-span-2 flex items-center">
        <Badge className={cn("px-3 py-1 rounded-full text-sm", getScoreBadgeColor(performance.score || 0))}>
          {performance.score?.toFixed(1) || '0.0'}%
        </Badge>
      </div>
      
      <div className="md:col-span-1 flex items-center">
        <span className="text-gray-700">{performance.jobs_completed || 0}</span>
      </div>
      
      <div className="md:col-span-2 flex items-center">
        <Badge className={cn("px-3 py-1 rounded-full text-sm", getSLABadgeColor(slaPercentage))}>
          {slaPercentage}% ({performance.sla_met || 0} met)
        </Badge>
      </div>
      
      <div className="md:col-span-2 flex items-center">
        <span className="text-red-600">{performance.sla_breached || 0} breached</span>
      </div>
      
      <div className="md:col-span-2 flex items-center">
        <div className="flex items-center">
          <div className="text-yellow-500 mr-1">★</div>
          <span className="font-medium">
            {(performance.rating_avg || 0).toFixed(1)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};