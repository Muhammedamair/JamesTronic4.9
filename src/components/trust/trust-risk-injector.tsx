'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Package, User, MessageCircle } from 'lucide-react';
import { getTrustCopy } from '@/lib/trust/trust-copy';
import { TrustOrchestrator } from '@/lib/trust/trustOrchestrator';

interface TrustRiskInjectorProps {
  ticket: any;
  className?: string;
}

export const TrustRiskInjector = ({ ticket, className }: TrustRiskInjectorProps) => {
  const [riskMessage, setRiskMessage] = useState<{ type: string, message: string, icon: any } | null>(null);

  useEffect(() => {
    if (!ticket) return;

    // Use trust orchestration to determine risk message
    const orchestrator = new TrustOrchestrator();
    const contextInput = {
      ticket: ticket,
      slaSnapshot: ticket?.sla_snapshot,
      partStatus: {
        required: ticket?.status?.toLowerCase() === 'parts_needed',
        status: ticket?.status?.toLowerCase() === 'parts_needed' ? 'ordered' as const : 'not_needed' as const
      },
      technicianStatus: ticket.assigned_technician_id ? 'assigned' as const : 'not_assigned' as const
    };

    const orchestrationResult = orchestrator.orchestrateTrust(contextInput);

    // Only show risk messages when orchestration indicates risk
    if (orchestrationResult.showTrustIndicator &&
      orchestrationResult.trustComponentType === 'risk-injector' &&
      orchestrationResult.trustMessage) {

      let messageType = 'warning';
      let messageIcon = AlertTriangle;

      if (ticket?.sla_snapshot?.status === 'breached') {
        messageType = 'critical';
        messageIcon = AlertTriangle;
      } else if (ticket?.status?.toLowerCase() === 'parts_needed') {
        messageType = 'info';
        messageIcon = Package;
      } else if (ticket?.status?.toLowerCase() === 'waiting_customer') {
        messageType = 'info';
        messageIcon = User;
      } else if (ticket?.assigned_technician_id === null && ticket?.status?.toLowerCase() === 'pending') {
        messageType = 'info';
        messageIcon = User;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRiskMessage({
        type: messageType,
        message: orchestrationResult.trustMessage,
        icon: messageIcon
      });
    } else {
      setRiskMessage(null);
    }
  }, [ticket]);

  if (!riskMessage) {
    return null;
  }

  const IconComponent = riskMessage.icon;

  return (
    <Card className={`border-l-4 ${riskMessage.type === 'critical' ? 'border-red-500 bg-red-50/30 dark:bg-red-900/20' :
        riskMessage.type === 'warning' ? 'border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/20' :
          'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20'
      } ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          Important Update
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${riskMessage.type === 'critical' ? 'text-red-600' :
              riskMessage.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
            }`} />
          <p className="text-gray-700 dark:text-gray-300">
            {riskMessage.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};