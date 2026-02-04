'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, Shield, User, Package } from 'lucide-react';
import { useCustomer } from '@/components/customer/customer-provider';
import { getTrustCopy } from '@/lib/trust/trust-copy';
import { TrustOrchestrator } from '@/lib/trust/trustOrchestrator';

interface PersistentTrustStripProps {
  onShowDetails?: () => void;
}

export const PersistentTrustStrip = ({ onShowDetails }: PersistentTrustStripProps) => {
  const { customerTickets } = useCustomer();
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [hasActiveTicket, setHasActiveTicket] = useState(false);
  const [trustStatus, setTrustStatus] = useState({
    status: 'safe',
    message: 'All repairs on track',
    icon: Clock
  });

  useEffect(() => {
    if (customerTickets && customerTickets.length > 0) {
      // Find the most relevant active ticket (not completed/delivered)
      const activeTicket = customerTickets.find((ticket: any) =>
        !['completed', 'delivered', 'closed', 'cancelled'].includes(ticket.status?.toLowerCase())
      ) || customerTickets[0]; // fallback to first ticket if none are active

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTicket(activeTicket);
      setHasActiveTicket(true);

      // Use trust orchestration to determine status
      const orchestrator = new TrustOrchestrator();
      const contextInput = {
        ticket: {
          id: activeTicket?.id,
          device_category: activeTicket?.device_category,
          brand: activeTicket?.brand,
          status: activeTicket?.status,
          created_at: activeTicket?.created_at,
          updated_at: activeTicket?.updated_at || new Date().toISOString()
        },
        slaSnapshot: activeTicket?.sla_snapshot,
        partStatus: {
          required: activeTicket?.status?.toLowerCase() === 'parts_needed',
          status: activeTicket?.status?.toLowerCase() === 'parts_needed' ? 'ordered' as const : 'not_needed' as const
        },
        technicianStatus: activeTicket.assigned_technician_id ? 'assigned' as const : 'not_assigned' as const
      };

      const orchestrationResult = orchestrator.orchestrateTrust(contextInput);

      if (orchestrationResult.showTrustIndicator) {
        // Map orchestration result to UI status
        let statusIcon = Clock;
        let statusMessage = orchestrationResult.trustMessage || getTrustCopy('general', 'transparency');
        let statusType = 'safe';

        if (orchestrationResult.trustComponentType === 'risk-injector') {
          statusIcon = AlertTriangle;
          statusType = 'at_risk';
          statusMessage = orchestrationResult.trustMessage || getTrustCopy('sla', 'risk');
        } else if (activeTicket?.sla_snapshot?.status === 'breached') {
          statusIcon = AlertTriangle;
          statusType = 'breached';
          statusMessage = orchestrationResult.trustMessage || getTrustCopy('delay', 'explanation');
        } else if (activeTicket?.status?.toLowerCase() === 'parts_needed') {
          statusIcon = Package;
          statusType = 'parts_needed';
          statusMessage = orchestrationResult.trustMessage || getTrustCopy('status', 'waitingPart');
        }

        setTrustStatus({
          status: statusType,
          message: statusMessage,
          icon: statusIcon
        });
      } else {
        setTrustStatus({
          status: 'safe',
          message: getTrustCopy('general', 'transparency'),
          icon: CheckCircle
        });
      }
    } else {
      setHasActiveTicket(false);
      setTrustStatus({
        status: 'no_tickets',
        message: 'No active repairs',
        icon: Shield
      });
    }
  }, [customerTickets]);

  const StatusIcon = trustStatus.icon;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${trustStatus.status === 'breached' ? 'text-red-600' :
                  trustStatus.status === 'at_risk' ? 'text-yellow-600' :
                    trustStatus.status === 'parts_needed' ? 'text-orange-600' : 'text-green-600'
                }`} />
              <span className="font-medium">
                {hasActiveTicket && activeTicket
                  ? `${activeTicket.device_category} ${activeTicket.brand ? `- ${activeTicket.brand}` : ''}`
                  : 'Repair Status'}
              </span>
            </div>
            <Badge
              variant={trustStatus.status === 'breached' ? 'destructive' :
                trustStatus.status === 'at_risk' ? 'secondary' :
                  trustStatus.status === 'parts_needed' ? 'outline' : 'default'}
              className={`
                ${trustStatus.status === 'breached' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                  trustStatus.status === 'at_risk' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                    trustStatus.status === 'parts_needed' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'}
              `}
            >
              {trustStatus.status === 'breached' ? 'BREACHED' :
                trustStatus.status === 'at_risk' ? 'AT RISK' :
                  trustStatus.status === 'parts_needed' ? 'PARTS NEEDED' :
                    trustStatus.status === 'no_tickets' ? 'NO ACTIVE REPAIRS' : 'ON TRACK'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
              {trustStatus.message}
            </p>
            {hasActiveTicket && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowDetails}
                className="text-xs"
              >
                Details
              </Button>
            )}
          </div>
        </div>

        {hasActiveTicket && activeTicket.sla_snapshot && (
          <div className="mt-2 flex items-center text-xs text-gray-600 dark:text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            SLA: {activeTicket.sla_snapshot.elapsed_hours || 0}h / {activeTicket.sla_snapshot.promised_hours || 0}h
          </div>
        )}
      </CardContent>
    </Card>
  );
};