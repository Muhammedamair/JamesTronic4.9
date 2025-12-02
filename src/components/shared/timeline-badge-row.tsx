'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Package, UserCheck, Shield, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TimelineBadgeRowProps {
  ticketId: string;
  verified?: boolean;
  timeBound?: boolean;
  slaProtected?: boolean;
  technicianConfirmed?: boolean;
  stageProgress?: string; // Current stage: 'initiated', 'in_progress', 'part_needed', 'ready', 'completed'
  isSLARisk?: boolean;
  partStatus?: string; // 'none', 'ordered', 'shipped', 'delivered'
}

export const TimelineBadgeRow = ({
  ticketId,
  verified = true,
  timeBound = true,
  slaProtected = true,
  technicianConfirmed = false,
  stageProgress = 'initiated',
  isSLARisk = false,
  partStatus = 'none'
}: TimelineBadgeRowProps) => {
  // Function to determine stage progress icon and text
  const getStageProgress = () => {
    switch (stageProgress) {
      case 'initiated':
        return { icon: Clock, text: 'Initiated', variant: 'outline' as const };
      case 'in_progress':
        return { icon: Clock, text: 'In Progress', variant: 'secondary' as const };
      case 'part_needed':
        return { icon: Package, text: 'Part Needed', variant: 'outline' as const };
      case 'ready':
        return { icon: CheckCircle, text: 'Ready', variant: 'secondary' as const };
      case 'completed':
        return { icon: CheckCircle, text: 'Completed', variant: 'default' as const };
      default:
        return { icon: Clock, text: 'Initiated', variant: 'outline' as const };
    }
  };

  const stageInfo = getStageProgress();

  return (
    <div className="flex flex-wrap gap-2 py-2 border-b border-gray-100 dark:border-gray-800">
      {verified && (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Verified
        </Badge>
      )}

      {timeBound && (
        <Badge variant="default" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Time-bound
        </Badge>
      )}

      {slaProtected && (
        <Badge variant="default" className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          SLA Protected
        </Badge>
      )}

      {technicianConfirmed && (
        <Badge variant="default" className="flex items-center gap-1">
          <UserCheck className="w-3 h-3" />
          Technician Confirmed
        </Badge>
      )}

      <Badge variant={stageInfo.variant} className="flex items-center gap-1">
        <stageInfo.icon className="w-3 h-3" />
        {stageInfo.text}
      </Badge>

      {isSLARisk && (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          SLA Risk
        </Badge>
      )}

      {partStatus !== 'none' && (
        <Badge variant={partStatus === 'delivered' ? 'default' : 
                      partStatus === 'shipped' ? 'secondary' : 'outline'} 
              className="flex items-center gap-1">
          <Package className="w-3 h-3" />
          {partStatus === 'ordered' && 'Part Ordered'}
          {partStatus === 'shipped' && 'Part Shipped'}
          {partStatus === 'delivered' && 'Part Delivered'}
        </Badge>
      )}
    </div>
  );
};

// Component that fetches and displays badge row data with error handling
export const TimelineBadgeRowWithFetch = ({ ticketId }: { ticketId: string }) => {
  const [badgeData, setBadgeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBadgeData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch from customer timeline endpoint
        const response = await fetch(`/api/customer/timeline/${ticketId}`);

        if (response.ok) {
          const data = await response.json();
          
          // Process timeline events to determine status
          const hasTechnician = data.some((event: any) => event.event_type === 'technician_assigned');
          const isSLARisk = data.some((event: any) => event.event_type === 'sla_at_risk');
          
          // Determine current stage based on timeline events
          let stage = 'initiated';
          if (data.some((event: any) => event.event_type === 'repair_completed')) stage = 'completed';
          else if (data.some((event: any) => event.event_type === 'ready_for_pickup')) stage = 'ready';
          else if (data.some((event: any) => event.event_type === 'parts_ordered')) stage = 'part_needed';
          else if (data.some((event: any) => event.event_type === 'repair_started')) stage = 'in_progress';
          
          const partStatus = data.some((event: any) => event.event_type === 'parts_delivered') ? 'delivered' :
                            data.some((event: any) => event.event_type === 'parts_shipped') ? 'shipped' :
                            data.some((event: any) => event.event_type === 'parts_ordered') ? 'ordered' : 'none';
          
          setBadgeData({
            verified: true, // Always true for JamesTronic tickets
            timeBound: true, // All tickets have SLA
            slaProtected: true, // All tickets have SLA protection
            technicianConfirmed: hasTechnician,
            stageProgress: stage,
            isSLARisk,
            partStatus
          });
        } else if (response.status === 404) {
          // No timeline events yet is okay
          setBadgeData({
            verified: true,
            timeBound: true,
            slaProtected: true,
            technicianConfirmed: false,
            stageProgress: 'initiated',
            isSLARisk: false,
            partStatus: 'none'
          });
        } else {
          throw new Error(`Failed to fetch timeline data: ${response.status}`);
        }
      } catch (err) {
        console.error('Error fetching timeline data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBadgeData();
  }, [ticketId]);

  if (loading || error) {
    // If there's an error, still return something useful
    return (
      <div className="flex flex-wrap gap-2 py-2 border-b border-gray-100 dark:border-gray-800">
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Initializing...
        </Badge>
      </div>
    );
  }

  if (!badgeData) {
    return (
      <div className="flex flex-wrap gap-2 py-2 border-b border-gray-100 dark:border-gray-800">
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          No data yet
        </Badge>
      </div>
    );
  }

  // Use the existing TimelineBadgeRow component with fetched data
  return (
    <TimelineBadgeRow
      ticketId={ticketId}
      verified={badgeData.verified}
      timeBound={badgeData.timeBound}
      slaProtected={badgeData.slaProtected}
      technicianConfirmed={badgeData.technicianConfirmed}
      stageProgress={badgeData.stageProgress}
      isSLARisk={badgeData.isSLARisk}
      partStatus={badgeData.partStatus}
    />
  );
};