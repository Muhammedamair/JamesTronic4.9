'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface SLADisplayProps {
  etaAt?: string;
  confidence?: number;
  riskLevel?: number;
  progressPct?: number;
  riskScore?: number;
  blockerCode?: string;
  burnRate?: number;
  className?: string;
}

const SLADisplay: React.FC<SLADisplayProps> = ({
  etaAt,
  confidence = 80,
  riskLevel = 0,
  progressPct = 0,
  riskScore = 0,
  blockerCode,
  burnRate = 0,
  className = ''
}) => {
  // Format risk level for display
  const getRiskLevelInfo = () => {
    switch (riskLevel) {
      case 3:
        return { label: 'High Risk', color: 'bg-red-500', icon: AlertTriangle, text: 'text-red-600' };
      case 2:
        return { label: 'Medium Risk', color: 'bg-orange-500', icon: AlertTriangle, text: 'text-orange-600' };
      case 1:
        return { label: 'Low Risk', color: 'bg-yellow-500', icon: AlertTriangle, text: 'text-yellow-600' };
      default:
        return { label: 'Low Risk', color: 'bg-green-500', icon: CheckCircle, text: 'text-green-600' };
    }
  };

  const riskInfo = getRiskLevelInfo();

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Service Level Agreement</CardTitle>
          <Badge variant={riskLevel === 0 ? 'default' : riskLevel === 1 ? 'secondary' : riskLevel === 2 ? 'destructive' : 'destructive'}>
            <riskInfo.icon className="h-3 w-3 mr-1" />
            {riskInfo.label}
          </Badge>
        </div>
        <CardDescription>Estimated completion and confidence metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ETA Display */}
        {etaAt && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-gray-500" />
              <span className="text-sm font-medium">Estimated Completion</span>
            </div>
            <span className="text-sm font-semibold">{format(new Date(etaAt), 'MMM dd, yyyy HH:mm')}</span>
          </div>
        )}

        {/* Confidence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-gray-500" />
              <span className="text-sm font-medium">Confidence Level</span>
            </div>
            <span className="text-sm font-semibold">{confidence}%</span>
          </div>
          <Progress value={confidence} className="h-2" />
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-semibold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Risk Score and Burn Rate */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div className="text-2xl font-bold text-blue-600">{riskScore.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Risk Score</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div className="text-2xl font-bold text-purple-600">{(burnRate * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Burn Rate</div>
          </div>
        </div>

        {/* Blocker Display */}
        {blockerCode && (
          <div className="pt-2">
            <div className="text-sm font-medium mb-1">Current Blocker</div>
            <Badge variant="outline" className="capitalize">
              {blockerCode.replace(/_/g, ' ')}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { SLADisplay };