'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Clock,
  Package,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Timer,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTrustCopy } from '@/lib/trust/trust-copy';

interface TrustPanelProps {
  ticketId: string;
  slaStatus?: string | null; // 'active', 'at_risk', 'breached', 'fulfilled'
  promisedHours?: number | null;
  elapsedHours?: number | null;
  assignedTechnician?: boolean;
  partRequired?: boolean;
  partStatus?: string; // 'ordered', 'shipped', 'delivered', etc.
  confidenceLevel?: 'high' | 'medium' | 'low'; // Confidence indicator
  status?: string; // Current ticket status
  lastUpdated?: string;
  compact?: boolean; // If true, shows a more compact version
}

export const TrustPanel = ({
  ticketId,
  slaStatus = 'active',
  promisedHours,
  elapsedHours,
  assignedTechnician = false,
  partRequired = false,
  partStatus,
  confidenceLevel = 'high',
  status,
  lastUpdated,
  compact = false
}: TrustPanelProps) => {
  // Determine status details for visual representation
  const getStatusDetails = () => {
    switch (slaStatus) {
      case 'breached':
        return {
          text: 'BREACHED',
          color: 'text-red-600',
          bgColor: 'bg-red-500',
          icon: AlertTriangle
        };
      case 'at_risk':
        return {
          text: 'AT RISK',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500',
          icon: AlertTriangle
        };
      case 'fulfilled':
        return {
          text: 'FULFILLED',
          color: 'text-green-600',
          bgColor: 'bg-green-500',
          icon: CheckCircle
        };
      default:
        return {
          text: 'SAFE',
          color: 'text-green-600',
          bgColor: 'bg-green-500',
          icon: Timer
        };
    }
  };

  const statusDetails = getStatusDetails();
  const StatusIcon = statusDetails.icon;

  // Calculate progress percentage and remaining time
  const progress = promisedHours && elapsedHours
    ? Math.min(100, Math.round((elapsedHours / promisedHours) * 100))
    : 0;

  const remainingHours = promisedHours && elapsedHours
    ? promisedHours - elapsedHours
    : null;

  // Determine current state for "WHAT'S HAPPENING NOW" module
  const getCurrentState = () => {
    if (status === 'part_required') {
      return getTrustCopy('status', 'waitingPart');
    } else if (status === 'in_progress') {
      return getTrustCopy('status', 'underRepair');
    } else if (status === 'ready') {
      return getTrustCopy('status', 'qualityCheck');
    } else if (status === 'waiting_customer') {
      return getTrustCopy('status', 'readyDelivery');
    } else if (status === 'pending') {
      return getTrustCopy('status', 'traveling');
    }
    return "Repair in progress";
  };

  // Determine confidence text
  const confidenceText = getTrustCopy('confidence', confidenceLevel);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${statusDetails.bgColor}`} />
        <span className="text-xs">{statusDetails.text}</span>
        {partRequired && (
          <Badge variant="secondary" className="text-xs">
            <Package className="w-3 h-3 mr-1" />
            PART
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {confidenceLevel.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-blue-600" />
          Repair Confidence Panel
        </CardTitle>
        <CardDescription>
          {getTrustCopy('general', 'transparency')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* SLA Status */}
          <div className="flex justify-between items-center">
            <Badge className={`${statusDetails.bgColor} text-white`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusDetails.text}
            </Badge>
            {lastUpdated && (
              <p className="text-xs text-gray-500">
                Updated {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          {/* Current State */}
          <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg">
            <p className="font-medium text-sm flex items-center gap-2">
              <span className="bg-blue-100 dark:bg-blue-900 p-1 rounded">
                <Timer className="w-4 h-4 text-blue-600" />
              </span>
              {getCurrentState()}
            </p>
          </div>

          {/* Confidence Level */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">Confidence Level</p>
              <p className="font-medium">{confidenceText}</p>
            </div>
            <Badge variant={confidenceLevel === 'high' ? 'default' :
                          confidenceLevel === 'medium' ? 'secondary' : 'destructive'}>
              {confidenceLevel.toUpperCase()}
            </Badge>
          </div>

          {/* Assignment Status */}
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Technician Assignment</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {assignedTechnician ? getTrustCopy('assignment', 'confirmed') : getTrustCopy('assignment', 'pending')}
              </p>
            </div>
            <Badge variant={assignedTechnician ? "default" : "outline"}>
              {assignedTechnician ? "CONFIRMED" : "PENDING"}
            </Badge>
          </div>

          {/* Parts Status */}
          {partRequired && (
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Parts Dependency</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {partStatus || getTrustCopy('parts', 'ordered')}
                </p>
              </div>
              <Badge variant={partStatus === 'delivered' ? "default" :
                            partStatus === 'shipped' ? "secondary" : "outline"}>
                {partStatus?.toUpperCase() || "REQUIRED"}
              </Badge>
            </div>
          )}

          {/* SLA Progress */}
          {promisedHours && elapsedHours && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>SLA Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />

              {/* Time remaining */}
              {remainingHours !== null && (
                <div className="mt-2 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">Time Status:</p>
                  <p className="font-medium">
                    {remainingHours > 0
                      ? getTrustCopy('sla', 'buffer', remainingHours)
                      : `${Math.abs(remainingHours)} hours overdue - ${getTrustCopy('sla', 'breached')}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trust markers */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {getTrustCopy('markers', 'noHiddenCharges')}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getTrustCopy('markers', 'repairTracked')}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getTrustCopy('markers', 'supportAlerted')}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Component that fetches and displays trust data with error handling
export const TrustPanelWithFetch = ({
  ticketId,
  compact = false
}: {
  ticketId: string;
  compact?: boolean;
}) => {
  const [trustData, setTrustData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchTrustData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch from customer SLA snapshot
        const response = await fetch(`/api/customer/sla/${ticketId}`);

        if (!response.ok) {
          if (response.status === 404) {
            // No trust data available, which is fine - set default values
            setTrustData({
              status: 'not_available',
              promised_hours: null,
              elapsed_hours: null,
              confidence_level: 'high',
              last_updated: null
            });
          } else {
            throw new Error(`Failed to fetch trust data: ${response.status} ${response.statusText}`);
          }
        } else {
          const data = await response.json();
          setTrustData(data);
        }
      } catch (err) {
        console.error('Error fetching trust data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTrustData();
  }, [ticketId, retryCount]);

  if (error) {
    return (
      <Card className="shadow-sm border-red-200 dark:border-red-800">
        <CardContent className="p-4 flex flex-col items-center justify-center">
          <WifiOff className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-3">
            {getTrustCopy('failure', 'systemChecking')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRetryCount(prev => prev + 1);
            }}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            {getTrustCopy('failure', 'stillSyncing')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 animate-pulse text-blue-600" />
            Repair Confidence Panel
          </CardTitle>
          <CardDescription>
            {getTrustCopy('general', 'transparency')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-full w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use the existing TrustPanel component with fetched data
  return (
    <TrustPanel
      ticketId={ticketId}
      slaStatus={trustData?.status}
      promisedHours={trustData?.promised_hours}
      elapsedHours={trustData?.elapsed_hours}
      confidenceLevel={trustData?.confidence_level || 'high'}
      lastUpdated={trustData?.last_updated}
      compact={compact}
    />
  );
};