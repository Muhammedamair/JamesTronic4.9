'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Bell, Eye, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface BookingConfirmationTrustProps {
  ticketId: string;
  deviceCategory?: string;
  estimatedCompletionHours?: number;
}

export const BookingConfirmationTrust = ({ 
  ticketId, 
  deviceCategory,
  estimatedCompletionHours 
}: BookingConfirmationTrustProps) => {
  const getExpectedCompletion = () => {
    if (!deviceCategory) {
      return 'within standard timeframe';
    }

    let hours = 0;
    switch (deviceCategory.toLowerCase()) {
      case 'mobile':
        hours = 24;
        break;
      case 'laptop':
        hours = 48;
        break;
      case 'television':
      case 'microwave':
        hours = 72;
        break;
      default:
        hours = 48; // Default
    }

    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    
    return `by ${estimatedCompletion.toLocaleString()}`;
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          Your Repair Timeline
        </CardTitle>
        <CardDescription>
          We update you before you ask
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Expected Completion</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your {deviceCategory || 'device'} repair is expected to be completed {getExpectedCompletion()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">How You'll Get Updates</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You will receive real-time timeline updates via our tracking system. We alert before any delays.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Navigation className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Track Your Ticket</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Follow your repair progress step-by-step on our tracking page.
              </p>
              <Button variant="outline" asChild>
                <Link href={`/app/tickets`}>View Ticket #${ticketId?.substring(0, 8)}</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};