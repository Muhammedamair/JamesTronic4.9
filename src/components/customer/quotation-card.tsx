'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket } from '@/lib/api/customer';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { customerAPI } from '@/lib/api/customer';
import { useSupabase } from '@/components/shared/supabase-provider';

interface QuotationCardProps {
  ticket: Ticket | null;
}

export function QuotationCard({ ticket }: QuotationCardProps) {
  const { user } = useSupabase();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    // Check network status
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleApprove = async () => {
    if (!ticket) return;

    if (networkStatus === 'offline') {
      toast.error('Cannot approve quotation while offline. Please connect to the internet.');
      return;
    }

    setIsApproving(true);
    try {
      await customerAPI.approveQuotation(ticket.id);
      toast.success('Quotation approved successfully!');
    } catch (error) {
      toast.error('Failed to approve quotation');
      console.error('Error approving quotation:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!ticket) return;

    if (networkStatus === 'offline') {
      toast.error('Cannot reject quotation while offline. Please connect to the internet.');
      return;
    }

    setIsRejecting(true);
    try {
      await customerAPI.rejectQuotation(ticket.id);
      toast.success('Quotation rejected successfully!');
    } catch (error) {
      toast.error('Failed to reject quotation');
      console.error('Error rejecting quotation:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  // Using ticket.quoted_price as a placeholder until we extend the Ticket type with quotation data
  const quotation = ticket?.quoted_price ? {
    id: 'placeholder',
    ticket_id: ticket.id,
    quoted_price: ticket.quoted_price,
    quote_notes: ticket.issue_details || 'No notes provided',
    created_at: ticket.created_at,
    status: ticket.status as 'pending' | 'approved' | 'rejected',
  } : null;

  if (!quotation) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Quotation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No quotation available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Quotation</CardTitle>
        <div className="flex items-center justify-between">
          <Badge
            variant={
              quotation.status === 'approved' ? 'default' :
                quotation.status === 'rejected' ? 'destructive' :
                  'secondary'
            }
          >
            {quotation.status.replace('_', ' ')}
          </Badge>
          <span className="text-2xl font-bold">₹{quotation.quoted_price?.toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {quotation.quote_notes && (
            <p className="text-sm text-muted-foreground">{quotation.quote_notes}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Quoted on: {new Date(quotation.created_at).toLocaleDateString()}
          </p>

          {quotation.status === 'pending' && (
            <div className="flex space-x-2 pt-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={handleApprove}
                disabled={isApproving || isRejecting || networkStatus === 'offline'}
              >
                {isApproving ? 'Approving...' : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handleReject}
                disabled={isApproving || isRejecting || networkStatus === 'offline'}
              >
                {isRejecting ? 'Rejecting...' : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}