'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket } from '@/lib/api/customer';
import { customerAPI } from '@/lib/api/customer';
import { Clock, Timer } from 'lucide-react';
import { updateCustomerCaches, getCachedSLA } from '@/lib/pwa-cache-service';
import { useSupabase } from '@/components/shared/supabase-provider';

interface SLACountdownProps {
  ticket: Ticket | null;
}

interface SLAData {
  ticket_id: string;
  promised_hours: number | null;
  elapsed_hours: number | null;
  status: string; // 'active', 'breached', 'fulfilled', 'at_risk'
  last_updated: string;
}

export function SLACountdown({ ticket }: SLACountdownProps) {
  const { user } = useSupabase();
  const [slaData, setSlaData] = useState<SLAData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (ticket?.id) {
      loadSLAData();
    }
  }, [ticket]);

  const loadSLAData = async () => {
    if (!ticket?.id) return;

    setIsLoading(true);

    try {
      // First check if we have cached data
      let cachedSLA = await getCachedSLA(ticket.id);

      if (cachedSLA && navigator.onLine) {
        setSlaData(cachedSLA);
      }

      // Fetch fresh data if online
      if (navigator.onLine) {
        const slaResponse = await customerAPI.getSLA(ticket.id);
        setSlaData(slaResponse);

        // Cache the fresh data
        await updateCustomerCaches(
          ticket.id,
          null, // ticket data
          slaResponse, // sla data
          null, // events data
          null // transporter data
        );

        // Calculate time remaining if we have promised hours
        if (slaResponse.promised_hours) {
          calculateTimeRemaining(slaResponse);
        }
      } else {
        // If offline, use cached data or show offline state
        if (cachedSLA) {
          setSlaData(cachedSLA);
          if (cachedSLA.promised_hours) {
            calculateTimeRemaining(cachedSLA);
          }
        } else {
          // Show offline state
          setSlaData({
            ticket_id: ticket.id,
            promised_hours: null,
            elapsed_hours: null,
            status: 'offline',
            last_updated: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error loading SLA data:', error);
      // If there was an error, try to use cached data
      const cachedSLA = await getCachedSLA(ticket.id);
      if (cachedSLA) {
        setSlaData(cachedSLA);
      } else {
        // Set a default state when no SLA is available
        setSlaData({
          ticket_id: ticket.id,
          promised_hours: null,
          elapsed_hours: null,
          status: 'not_available',
          last_updated: new Date().toISOString()
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTimeRemaining = (sla: SLAData) => {
    // This is a placeholder implementation - in reality, you'd calculate based on
    // the SLA start time and promised hours
    if (sla.promised_hours) {
      // For demo purposes, we'll create a fake "time remaining" based on status
      if (sla.status === 'active') {
        setTimeRemaining(`${sla.promised_hours}h remaining`);
      } else if (sla.status === 'at_risk') {
        setTimeRemaining('At risk of delay');
      } else if (sla.status === 'breached') {
        setTimeRemaining('SLA breached');
      } else if (sla.status === 'fulfilled') {
        setTimeRemaining('Completed on time');
      }
    }
  };

  if (!ticket || isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">SLA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            {isLoading ? (
              <p className="text-muted-foreground">Loading SLA data...</p>
            ) : (
              <p className="text-muted-foreground">Select a repair to see SLA status</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine badge variant based on SLA status
  const statusVariant =
    slaData?.status === 'fulfilled' ? 'default' :
      slaData?.status === 'breached' ? 'destructive' :
        slaData?.status === 'at_risk' ? 'destructive' : // Using destructive for at risk too
          slaData?.status === 'active' ? 'secondary' :
            'outline';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">SLA Status</CardTitle>
        <div className="flex items-center justify-between">
          <Badge variant={statusVariant}>
            {slaData?.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            {slaData?.promised_hours ? (
              <>
                <p className="font-semibold">{slaData.promised_hours}h SLA</p>
                <p className="text-sm text-muted-foreground">
                  {timeRemaining || 'Calculating...'}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No SLA defined</p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Last updated: {slaData?.last_updated ? new Date(slaData.last_updated).toLocaleString() : 'Never'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}