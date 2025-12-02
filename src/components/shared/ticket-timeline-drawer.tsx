'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  User,
  Wrench,
  Package,
  CheckCircle,
  CircleDashed,
  AlertTriangle,
  Calendar,
  PackageCheck,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { TimelineEvent } from '@/lib/api/customer';
import { useCustomer } from '@/components/customer/customer-provider';
import { formatTimeAgo, formatDate } from '@/lib/utils/date-utils';
import { Progress } from '@/components/ui/progress';
import { SLADisplayWithFetch } from '@/components/shared/sla-display';
import { TrustPanelWithFetch } from '@/components/trust/trust-panel';
import { TimelineBadgeRowWithFetch } from '@/components/shared/timeline-badge-row';
import { ConfidenceBannerWithFetch } from '@/components/trust/confidence-banner';
import { TrustRiskInjector } from '@/components/trust/trust-risk-injector';
import { CompletionTrustSummary } from '@/components/trust/completion-trust-summary';

interface TicketTimelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: any; // Should be a ticket from the customer API
}

const TimelineEventItem = ({ event }: { event: TimelineEvent }) => {
  // Define icons for different event types
  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'ticket_created':
        return <CircleDashed className="w-5 h-5" />;
      case 'technician_assigned':
        return <User className="w-5 h-5" />;
      case 'diagnosis_started':
      case 'repair_started':
        return <Wrench className="w-5 h-5" />;
      case 'parts_ordered':
        return <Package className="w-5 h-5" />;
      case 'repair_completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'delivered':
        return <PackageCheck className="w-5 h-5" />;
      case 'sla_breached':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
          {getEventIcon(event.event_type)}
        </div>
        <div className="h-full w-px bg-gray-200 dark:bg-gray-700 mt-1 flex-1"></div>
      </div>
      <div className="flex-1 pb-6">
        <h4 className="font-semibold">{event.title}</h4>
        {event.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{event.description}</p>
        )}
        <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
          {formatDate(new Date(event.created_at))}
        </p>
      </div>
    </div>
  );
};

export const TicketTimelineDrawer = ({
  open,
  onOpenChange,
  ticket
}: TicketTimelineDrawerProps) => {
  const { customerData } = useCustomer();
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [slaData, setSlaData] = useState<any>(null);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the ticket is completed
  const isCompleted = ticket?.status?.toLowerCase() === 'completed' ||
                     ticket?.status?.toLowerCase() === 'delivered' ||
                     ticket?.status?.toLowerCase() === 'closed';

  useEffect(() => {
    if (open && ticket?.id) {
      const fetchTimelineAndSLA = async () => {
        try {
          setHasError(false);
          setLoading(true);

          // Fetch timeline
          const timelineResponse = await fetch(`/api/customer/timeline/${ticket.id}`);
          if (timelineResponse.ok) {
            const timelineData = await timelineResponse.json();
            setTimelineEvents(timelineData);
          } else if (timelineResponse.status === 404) {
            // No timeline events yet is okay
            setTimelineEvents([]);
          } else {
            throw new Error(`Failed to fetch timeline: ${timelineResponse.status}`);
          }

          // Fetch SLA data
          const slaResponse = await fetch(`/api/customer/sla/${ticket.id}`);
          if (slaResponse.ok) {
            const slaData = await slaResponse.json();
            setSlaData(slaData);
          } else if (slaResponse.status === 404) {
            // No SLA data yet is okay
            setSlaData(null);
          } else {
            throw new Error(`Failed to fetch SLA: ${slaResponse.status}`);
          }
        } catch (error) {
          console.error('Error fetching timeline/SLA:', error);
          setHasError(true);
          setError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchTimelineAndSLA();
    }
  }, [open, ticket?.id]);

  const handleRetry = () => {
    setHasError(false);
    setError(null);
    if (open && ticket?.id) {
      const fetchTimelineAndSLA = async () => {
        try {
          setLoading(true);

          // Fetch timeline
          const timelineResponse = await fetch(`/api/customer/timeline/${ticket.id}`);
          if (timelineResponse.ok) {
            const timelineData = await timelineResponse.json();
            setTimelineEvents(timelineData);
          } else if (timelineResponse.status === 404) {
            setTimelineEvents([]);
          } else {
            throw new Error(`Failed to fetch timeline: ${timelineResponse.status}`);
          }

          // Fetch SLA data
          const slaResponse = await fetch(`/api/customer/sla/${ticket.id}`);
          if (slaResponse.ok) {
            const slaData = await slaResponse.json();
            setSlaData(slaData);
          } else if (slaResponse.status === 404) {
            setSlaData(null);
          } else {
            throw new Error(`Failed to fetch SLA: ${slaResponse.status}`);
          }
        } catch (error) {
          console.error('Error fetching timeline/SLA:', error);
          setHasError(true);
          setError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchTimelineAndSLA();
    }
  };

  const getSLAProgress = () => {
    if (slaData?.promised_hours && slaData?.elapsed_hours) {
      const progress = Math.min(100, (slaData.elapsed_hours / slaData.promised_hours) * 100);
      return Math.round(progress);
    }
    return 0;
  };

  const getSLAStatusText = () => {
    if (slaData?.status === 'breached') {
      return 'SLA Breached';
    } else if (slaData?.status === 'at_risk') {
      return 'At Risk of Breach';
    } else if (slaData?.status === 'fulfilled') {
      return 'Completed On Time';
    }
    return 'On Track';
  };

  const getStatusColor = () => {
    if (slaData?.status === 'breached') {
      return 'bg-red-500';
    } else if (slaData?.status === 'at_risk') {
      return 'bg-yellow-500';
    }
    return 'bg-green-500';
  };

  if (hasError) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Repair Timeline: {ticket.device_category} {ticket.brand && `- ${ticket.brand}`}
              </DrawerTitle>
              <DrawerDescription>
                Track all updates for your repair
              </DrawerDescription>
            </DrawerHeader>

            <div className="p-4 flex flex-col items-center justify-center min-h-[300px]">
              <WifiOff className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Unable to load timeline</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                There was an issue loading the repair timeline.
                {error && <span className="block mt-2 text-sm text-red-500">{error}</span>}
              </p>
              <Button
                onClick={handleRetry}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (isCompleted) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Repair Completed: {ticket.device_category} {ticket.brand && `- ${ticket.brand}`}
              </DrawerTitle>
              <DrawerDescription>
                Your repair has been completed
              </DrawerDescription>
            </DrawerHeader>

            <div className="p-4">
              <CompletionTrustSummary ticket={ticket} />
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Repair Timeline: {ticket.device_category} {ticket.brand && `- ${ticket.brand}`}
            </DrawerTitle>
            <DrawerDescription>
              Track all updates for your repair
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4">
            {/* Trust Risk Injector - shows important updates in risk moments */}
            {ticket && (
              <div className="mb-4">
                <TrustRiskInjector ticket={ticket} />
              </div>
            )}

            {/* Confidence Banner (only shown when needed) */}
            {ticket.id && (
              <div className="mb-4">
                <ConfidenceBannerWithFetch ticketId={ticket.id} />
              </div>
            )}

            {/* Timeline Badges Row */}
            {ticket.id && (
              <div className="mb-4">
                <TimelineBadgeRowWithFetch ticketId={ticket.id} />
              </div>
            )}

            {/* Repair Summary */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{ticket.device_category} {ticket.brand && `- ${ticket.brand}`} {ticket.model && `- ${ticket.model}`}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                    Added {formatTimeAgo(new Date(ticket.created_at))}
                  </p>
                </div>

                <div className="text-right md:text-left">
                  <Badge className={`${getStatusColor()} text-white`}>
                    {getSLAStatusText()}
                  </Badge>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>SLA Progress</span>
                      <span>{getSLAProgress()}%</span>
                    </div>
                    <Progress value={getSLAProgress()} className="w-full" />
                  </div>
                </div>
              </div>

              {ticket.assigned_technician && (
                <div className="mt-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    <span className="font-medium">Technician:</span> {ticket.assigned_technician.full_name}
                  </span>
                </div>
              )}

              {ticket.issue_summary && (
                <div className="mt-2">
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    <span className="font-medium">Issue:</span> {ticket.issue_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Trust Panel */}
            {ticket.id && (
              <div className="mb-6">
                <TrustPanelWithFetch ticketId={ticket.id} />
              </div>
            )}

            {/* Timeline Events */}
            <div className="mb-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Event Timeline
              </h3>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="rounded-full bg-gray-200 dark:bg-gray-700 p-2 w-10 h-10 animate-pulse" />
                        <div className="h-full w-px bg-gray-200 dark:bg-gray-700 mt-1 flex-1"></div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : timelineEvents.length > 0 ? (
                <div className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-700">
                  {timelineEvents.map((event) => (
                    <TimelineEventItem key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No timeline events yet. Check back for updates!
                </div>
              )}
            </div>

            {/* SLA Information */}
            {ticket.id && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <SLADisplayWithFetch ticketId={ticket.id} />
              </div>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};