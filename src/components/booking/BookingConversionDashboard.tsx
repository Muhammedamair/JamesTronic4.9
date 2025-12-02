/**
 * BookingConversionDashboard.tsx
 * 
 * Dashboard component to display booking conversion metrics
 * and insights from the booking control & conversion layer
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBookingFlow } from '@/components/booking/BookingFlowProvider';

interface BookingConversionDashboardProps {
  className?: string;
}

export const BookingConversionDashboard: React.FC<BookingConversionDashboardProps> = ({ 
  className = '' 
}) => {
  const { bookingFlowEngine } = useBookingFlow();
  
  // Get session stats from the drop-off detector
  const sessionStats = bookingFlowEngine ? bookingFlowEngine.getSessionStats() : {
    totalSessions: 0,
    dropOffs: 0,
    bounceAttempts: 0,
    hesitations: 0,
    completionRate: 0,
  };

  // Calculate additional metrics
  const dropOffRate = sessionStats.totalSessions > 0 
    ? (sessionStats.dropOffs / sessionStats.totalSessions) * 100 
    : 0;
    
  const bounceRate = sessionStats.totalSessions > 0 
    ? (sessionStats.bounceAttempts / sessionStats.totalSessions) * 100 
    : 0;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* Total Sessions Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Sessions</CardDescription>
          <CardTitle className="text-2xl">{sessionStats.totalSessions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Active booking flows
          </div>
        </CardContent>
      </Card>

      {/* Completion Rate Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Completion Rate</CardDescription>
          <CardTitle className="text-2xl">{sessionStats.completionRate.toFixed(1)}%</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={sessionStats.completionRate} className="h-2" />
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {sessionStats.totalSessions - sessionStats.dropOffs} completed out of {sessionStats.totalSessions}
          </div>
        </CardContent>
      </Card>

      {/* Drop-off Rate Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Drop-off Rate</CardDescription>
          <CardTitle className="text-2xl">{dropOffRate.toFixed(1)}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {dropOffRate > 20 ? (
              <Badge variant="destructive">High</Badge>
            ) : dropOffRate > 10 ? (
              <Badge variant="default">Medium</Badge>
            ) : (
              <Badge variant="secondary">Low</Badge>
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {sessionStats.dropOffs} drop-offs
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bounce Rate Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Bounce Rate</CardDescription>
          <CardTitle className="text-2xl">{bounceRate.toFixed(1)}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {bounceRate > 15 ? (
              <Badge variant="destructive">High</Badge>
            ) : bounceRate > 5 ? (
              <Badge variant="default">Medium</Badge>
            ) : (
              <Badge variant="secondary">Low</Badge>
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {sessionStats.bounceAttempts} bounces
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};