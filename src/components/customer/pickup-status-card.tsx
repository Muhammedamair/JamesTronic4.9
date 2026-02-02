'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket } from '@/lib/api/customer';
import { Truck, MapPin, Calendar, CheckCircle } from 'lucide-react';

interface PickupStatusCardProps {
  ticket: Ticket | null;
}

export function PickupStatusCard({ ticket }: PickupStatusCardProps) {
  // In a real implementation, this would show detailed transporter pickup/drop status
  // For now, using the available fields in the ticket

  if (!ticket) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Transporter Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Select a repair to see transporter status</p>
        </CardContent>
      </Card>
    );
  }

  // Determine the current transporter status based on ticket fields
  const getStatusInfo = () => {
    if (ticket.status === 'completed') {
      return {
        status: 'Delivery Completed',
        icon: <CheckCircle className="h-5 w-5" />,
        description: 'Your repaired appliance has been delivered',
        variant: 'default' as const
      };
    } else if (ticket.assigned_technician_id) {
      // If technician is assigned but status isn't completed, it means work is in progress
      return {
        status: 'In Transit',
        icon: <Truck className="h-5 w-5" />,
        description: 'Item is being transported for repair or delivery',
        variant: 'secondary' as const
      };
    } else if (ticket.status === 'pending' || ticket.status === 'in_progress') {
      return {
        status: 'Awaiting Transport',
        icon: <Calendar className="h-5 w-5" />,
        description: 'Pickup/delivery scheduled once repair is complete',
        variant: 'secondary' as const
      };
    } else {
      return {
        status: 'Not Scheduled',
        icon: <MapPin className="h-5 w-5" />,
        description: 'Transportation not yet scheduled',
        variant: 'outline' as const
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Transporter Status</CardTitle>
        <div className="flex items-center justify-between">
          <Badge variant={statusInfo.variant}>
            {statusInfo.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start space-x-3">
          <div className="mt-0.5 text-muted-foreground">
            {statusInfo.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm">{statusInfo.description}</p>

            {ticket.assigned_technician_id && ticket.status !== 'completed' && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">In Transit</p>
                <p className="font-medium">Item is with technician for repair</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}