'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, CheckCircle, Timer, RefreshCw, WifiOff } from 'lucide-react';
import { useCustomer } from '@/components/customer/customer-provider';
import { formatTimeAgo } from '@/lib/utils/date-utils';
import { Button } from '@/components/ui/button';

interface SLADisplayProps {
  ticketId: string;
  promisedHours?: number | null;
  elapsedHours?: number | null;
  status?: string; // 'active', 'breached', 'fulfilled', 'at_risk'
  lastUpdated?: string;
  compact?: boolean; // If true, shows a more compact version
}

export const SLADisplay = ({
  ticketId,
  promisedHours,
  elapsedHours,
  status = 'active',
  lastUpdated,
  compact = false
}: SLADisplayProps) => {
  // Determine status details
  const getStatusDetails = () => {
    switch (status) {
      case 'breached':
        return {
          text: 'SLA Breached',
          color: 'text-red-600',
          bgColor: 'bg-red-500',
          icon: AlertTriangle
        };
      case 'at_risk':
        return {
          text: 'At Risk',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500',
          icon: AlertTriangle
        };
      case 'fulfilled':
        return {
          text: 'Completed',
          color: 'text-green-600',
          bgColor: 'bg-green-500',
          icon: CheckCircle
        };
      default:
        return {
          text: 'On Track',
          color: 'text-green-600',
          bgColor: 'bg-green-500',
          icon: Timer
        };
    }
  };

  const statusDetails = getStatusDetails();
  const StatusIcon = statusDetails.icon;

  // Calculate progress percentage
  const progress = promisedHours && elapsedHours
    ? Math.min(100, Math.round((elapsedHours / promisedHours) * 100))
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${statusDetails.bgColor}`} />
        <span className="text-xs">{statusDetails.text}</span>
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5" />
          Service Level Agreement
        </CardTitle>
        <CardDescription>
          Time commitment for your repair
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Badge className={`${statusDetails.bgColor} text-white`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusDetails.text}
            </Badge>
            {lastUpdated && (
              <p className="text-xs text-gray-500">
                Updated {formatTimeAgo(new Date(lastUpdated))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Promised Time</p>
              <p className="font-medium">{promisedHours || 'N/A'} hours</p>
            </div>

            <div>
              <p className="text-gray-600 dark:text-gray-400">Elapsed Time</p>
              <p className="font-medium">{elapsedHours ? Math.round(elapsedHours) : 'N/A'} hours</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Component that fetches and displays SLA data with error handling
export const SLADisplayWithFetch = ({
  ticketId,
  compact = false
}: {
  ticketId: string;
  compact?: boolean;
}) => {
  const [slaData, setSlaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchSLA = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`/api/customer/sla/${ticketId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No SLA data available, which is fine - set default values
          setSlaData({
            promised_hours: null,
            elapsed_hours: null,
            status: 'not_available',
            last_updated: null
          });
        } else {
          throw new Error(`Failed to fetch SLA data: ${response.status} ${response.statusText}`);
        }
      } else {
        const data = await response.json();
        setSlaData(data);
      }
    } catch (err) {
      console.error('Error fetching SLA data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSLA();
  }, [ticketId, retryCount]);

  if (error) {
    return (
      <Card className="shadow-sm border-red-200 dark:border-red-800">
        <CardContent className="p-4 flex flex-col items-center justify-center">
          <WifiOff className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-3">
            Unable to load SLA information
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
            Retry
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
            <Clock className="w-5 h-5 animate-pulse" />
            Service Level Agreement
          </CardTitle>
          <CardDescription>
            Loading time commitment...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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

  // Use the existing SLADisplay component with fetched data
  return (
    <SLADisplay
      ticketId={ticketId}
      promisedHours={slaData?.promised_hours}
      elapsedHours={slaData?.elapsed_hours}
      status={slaData?.status}
      lastUpdated={slaData?.last_updated}
      compact={compact}
    />
  );
};

// Component for displaying SLA in a customer's ticket list item
export const TicketSLADisplay = ({
  promisedHours,
  elapsedHours,
  status
}: {
  promisedHours?: number | null;
  elapsedHours?: number | null;
  status?: string;
}) => {
  if (status === undefined) {
    return null;
  }

  const getStatusColor = () => {
    switch (status) {
      case 'breached': return 'bg-red-500';
      case 'at_risk': return 'bg-yellow-500';
      case 'fulfilled': return 'bg-green-500';
      default: return 'bg-green-500';
    }
  };

  const getSLAStatusText = () => {
    switch (status) {
      case 'breached': return 'Breached';
      case 'at_risk': return 'At Risk';
      case 'fulfilled': return 'Fulfilled';
      default: return 'On Track';
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs">{getSLAStatusText()}</span>
    </div>
  );
};

// Component that fetches and displays SLA data for a ticket list item with error handling
export const TicketSLADisplayWithFetch = ({ ticketId }: { ticketId: string }) => {
  const [slaData, setSlaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSLA = async () => {
      try {
        setError(null);
        setLoading(true);

        const response = await fetch(`/api/customer/sla/${ticketId}`);

        if (!response.ok) {
          if (response.status !== 404) { // 404 is fine, means no SLA yet
            throw new Error(`Failed to fetch SLA: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setSlaData(data);
        }
      } catch (err) {
        console.error('Error in TicketSLADisplayWithFetch:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSLA();
  }, [ticketId]);

  if (error || loading) {
    return null; // Don't show error in compact view, just return nothing if there's an issue
  }

  if (!slaData) {
    return null; // No SLA data available
  }

  return (
    <TicketSLADisplay
      promisedHours={slaData.promised_hours}
      elapsedHours={slaData.elapsed_hours}
      status={slaData.status}
    />
  );
};