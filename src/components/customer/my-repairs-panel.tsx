'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Wrench,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  CircleDashed,
  Package,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useCustomer } from '@/components/customer/customer-provider';
import { formatTimeAgo } from '@/lib/utils/date-utils';
import { useState } from 'react';
import { TicketTimelineDrawer } from '@/components/shared/ticket-timeline-drawer';
import { TrustPanelWithFetch } from '@/components/trust/trust-panel';
import { TimelineBadgeRowWithFetch } from '@/components/shared/timeline-badge-row';
import { ConfidenceBannerWithFetch } from '@/components/trust/confidence-banner';

interface RepairStatusProps {
  status: string;
  createdAt: string;
  updatedAt: string;
}

const RepairStatusBadge = ({ status, createdAt, updatedAt }: RepairStatusProps) => {
  // Define status colors and icons
  const statusConfig: Record<string, { color: string; icon: any }> = {
    pending: { color: 'bg-gray-500', icon: CircleDashed },
    assigned: { color: 'bg-blue-500', icon: User },
    'in progress': { color: 'bg-yellow-500', icon: Wrench },
    'repair started': { color: 'bg-yellow-500', icon: Wrench },
    'parts needed': { color: 'bg-orange-500', icon: Package },
    completed: { color: 'bg-green-500', icon: CheckCircle },
    delivered: { color: 'bg-green-500', icon: CheckCircle },
    cancelled: { color: 'bg-red-500', icon: AlertTriangle },
    closed: { color: 'bg-gray-500', icon: CheckCircle },
  };

  const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      <span className="capitalize">{status.replace('_', ' ')}</span>
    </div>
  );
};

const SLAStatusBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<string, { color: string; text: string }> = {
    active: { color: 'bg-green-500', text: 'On Track' },
    at_risk: { color: 'bg-yellow-500', text: 'At Risk' },
    breached: { color: 'bg-red-500', text: 'Breached' },
    fulfilled: { color: 'bg-green-500', text: 'Completed' },
  };

  const config = statusConfig[status] || statusConfig.active;

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs">{config.text}</span>
    </div>
  );
};

interface MyRepairsPanelProps {
  onTicketSelect?: (ticket: any) => void;
}

const MyRepairsPanel = ({ onTicketSelect }: MyRepairsPanelProps = {}) => {
  const { customerTickets, isLoading, isCustomer, refetchCustomerData } = useCustomer();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  if (!isCustomer) {
    return null; // Don't render if not a customer
  }

  // Handle potential API or data loading errors
  if (hasError) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            My Repairs
          </CardTitle>
          <CardDescription>Track your repair status in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <WifiOff className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <h3 className="font-semibold mb-2">Unable to load repairs</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              There was a problem loading your repair information.
            </p>
            <Button
              onClick={() => {
                setHasError(false);
                refetchCustomerData();
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            My Repairs
          </CardTitle>
          <CardDescription>Track your repair status in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!customerTickets || customerTickets.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            My Repairs
          </CardTitle>
          <CardDescription>Track your repair status in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Wrench className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600 dark:text-gray-400">You have no active repairs</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Your repair tickets will appear here once you create them
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if tickets data is valid
  const validTickets = customerTickets.filter(ticket => ticket && ticket.id);

  if (validTickets.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            My Repairs
          </CardTitle>
          <CardDescription>Track your repair status in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Wrench className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600 dark:text-gray-400">No valid repair data</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              There may be an issue with the repair data. Please try again later.
            </p>
            <Button
              onClick={refetchCustomerData}
              variant="outline"
              className="mt-4"
            >
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          My Repairs
        </CardTitle>
        <CardDescription>Track your repair status in real-time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {validTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => {
                if (onTicketSelect) {
                  onTicketSelect(ticket);
                } else {
                  setSelectedTicket(ticket);
                }
              }}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">
                      {ticket.device_category} {ticket.brand ? `- ${ticket.brand}` : ''} {ticket.model ? `- ${ticket.model}` : ''}
                    </h3>
                    {ticket.status.toLowerCase().includes('breach') || ticket.status === 'Parts Needed' ? (
                      <Badge variant="outline" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        Parts
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Created {formatTimeAgo(new Date(ticket.created_at))}</span>
                    </div>

                    {ticket.assigned_technician?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{ticket.assigned_technician.full_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <div className="flex items-center">
                      <RepairStatusBadge
                        status={ticket.status}
                        createdAt={ticket.created_at}
                        updatedAt={ticket.updated_at}
                      />
                    </div>

                    {ticket.sla_snapshot?.status && (
                      <div className="flex items-center">
                        <SLAStatusBadge status={ticket.sla_snapshot.status} />
                      </div>
                    )}
                  </div>

                  {/* Trust indicators for SLA and timeline - only shown if the ticket has an ID */}
                  {ticket.id && (
                    <>
                      {/* Confidence Banner - only shown when there are issues/delays */}
                      <div className="mb-2">
                        <ConfidenceBannerWithFetch ticketId={ticket.id} />
                      </div>

                      {/* Timeline Badges Row - shows progress indicators */}
                      <div className="mb-2">
                        <TimelineBadgeRowWithFetch ticketId={ticket.id} />
                      </div>

                      {/* Compact Trust Panel - shows key trust metrics */}
                      <div className="mt-2">
                        <TrustPanelWithFetch ticketId={ticket.id} compact={true} />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-2 sm:mt-0 sm:ml-4">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {selectedTicket && !onTicketSelect && (
        <TicketTimelineDrawer
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={() => setSelectedTicket(null)}
        />
      )}
    </Card>
  );
};

export default MyRepairsPanel;