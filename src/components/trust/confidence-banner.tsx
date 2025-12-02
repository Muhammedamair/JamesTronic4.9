'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Package, Wrench } from 'lucide-react';
import { useState } from 'react';
import { getTrustCopy } from '@/lib/trust/trust-copy';
import React from 'react';

interface ConfidenceBannerProps {
  ticketId: string;
  slaStatus?: string; // 'active', 'at_risk', 'breached', 'fulfilled'
  partStatus?: string; // 'none', 'ordered', 'shipped', 'delivered', 'delayed'
  status?: string; // Current ticket status
  newETA?: string; // New estimated time of arrival if delayed
  show?: boolean; // Whether to show the banner
}

export const ConfidenceBanner = ({
  ticketId,
  slaStatus = 'active',
  partStatus = 'none',
  status,
  newETA,
  show = false
}: ConfidenceBannerProps) => {
  if (!show) {
    return null;
  }

  // Determine if this is a delay situation that needs the honesty banner
  const isDelaySituation = slaStatus === 'breached' ||
                          slaStatus === 'at_risk' ||
                          partStatus === 'delayed';

  if (!isDelaySituation) {
    return null;
  }

  // Determine banner type and content based on situation
  let bannerVariant: 'default' | 'destructive' | 'secondary' = 'default';
  let icon = AlertTriangle;
  let title = getTrustCopy('delay', 'explanation');
  let description = getTrustCopy('delay', 'accountability');
  let additionalInfo = '';

  if (slaStatus === 'breached') {
    bannerVariant = 'destructive';
    title = "We're behind schedule";
    description = getTrustCopy('sla', 'breached');
    additionalInfo = "Taking extra steps to complete your repair";
  } else if (slaStatus === 'at_risk') {
    bannerVariant = 'secondary';
    title = "Potential delay ahead";
    description = getTrustCopy('sla', 'risk');
    additionalInfo = "Working to keep your repair on track";
  } else if (partStatus === 'delayed') {
    bannerVariant = 'secondary';
    icon = Package;
    title = "Part delay";
    description = getTrustCopy('parts', 'delay');
    additionalInfo = `Expected: ${newETA || 'TBD'}`;
  }

  // Select appropriate icon based on the situation
  if (slaStatus === 'breached' || slaStatus === 'at_risk') {
    icon = Clock;
  } else if (partStatus === 'delayed') {
    icon = Package;
  } else {
    icon = Wrench;
  }

  return (
    <Alert className={`border-l-4 ${bannerVariant === 'destructive' ? 'border-red-500 bg-red-50/30' :
                        bannerVariant === 'secondary' ? 'border-yellow-500 bg-yellow-50/30' :
                        'border-blue-500 bg-blue-50/30'}`}>
      {React.createElement(icon, {
        className: `h-4 w-4 ${bannerVariant === 'destructive' ? 'text-red-600' :
                        bannerVariant === 'secondary' ? 'text-yellow-600' :
                        'text-blue-600'}`
      })}
      <AlertTitle className="font-semibold">
        {title}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <div>{description}</div>
        {newETA && (
          <Badge className={`mt-1 ${bannerVariant === 'destructive' ? 'bg-red-100 text-red-800' :
                              bannerVariant === 'secondary' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'}`}>
            {getTrustCopy('delay', 'newETA', newETA)}
          </Badge>
        )}
        {additionalInfo && (
          <div className="text-sm mt-1">
            {additionalInfo}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

// Component that fetches and displays confidence banner with error handling
export const ConfidenceBannerWithFetch = ({ ticketId }: { ticketId: string }) => {
  const [bannerData, setBannerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    const fetchBannerData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch from customer SLA snapshot and timeline
        const [slaResponse, timelineResponse] = await Promise.allSettled([
          fetch(`/api/customer/sla/${ticketId}`),
          fetch(`/api/customer/timeline/${ticketId}`)
        ]);

        let slaData = null;
        let timelineData = [];

        if (slaResponse.status === 'fulfilled' && slaResponse.value.ok) {
          slaData = await slaResponse.value.json();
        } else if (slaResponse.status === 'rejected' || !slaResponse.value.ok) {
          console.error('Error fetching SLA data:', slaResponse.status === 'rejected' ? slaResponse.reason : await slaResponse.value.text());
        }

        if (timelineResponse.status === 'fulfilled' && timelineResponse.value.ok) {
          timelineData = await timelineResponse.value.json();
        } else if (timelineResponse.status === 'rejected' || !timelineResponse.value.ok) {
          console.error('Error fetching timeline data:', timelineResponse.status === 'rejected' ? timelineResponse.reason : await timelineResponse.value.text());
        }

        // Process data to determine if a banner should be shown
        const isSLARisk = slaData?.status === 'at_risk' || slaData?.status === 'breached';
        const hasPartDelay = timelineData.some((event: any) =>
          event.event_type === 'part_delay' || event.event_type === 'part_order_delayed'
        );

        // Find new ETA from timeline events if available
        let newETA = null;
        if (hasPartDelay) {
          // Look for an event with an updated ETA
          const etaEvent = timelineData.find((event: any) =>
            event.event_type === 'part_delay' && event.metadata?.new_eta
          );
          if (etaEvent) {
            newETA = etaEvent.metadata.new_eta;
          }
        }

        setBannerData({
          show: isSLARisk || hasPartDelay,
          slaStatus: slaData?.status,
          partStatus: hasPartDelay ? 'delayed' : 'none',
          status: null,
          newETA
        });
      } catch (err) {
        console.error('Error fetching banner data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBannerData();
  });

  if (loading || error || !bannerData) {
    return null; // Don't show banner while loading or if there's an error
  }

  // Use the existing ConfidenceBanner component with fetched data
  return (
    <ConfidenceBanner
      ticketId={ticketId}
      slaStatus={bannerData.slaStatus}
      partStatus={bannerData.partStatus}
      status={bannerData.status}
      newETA={bannerData.newETA}
      show={bannerData.show}
    />
  );
};