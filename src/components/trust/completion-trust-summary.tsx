'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Star, Shield } from 'lucide-react';
import { useState } from 'react';
import { TrustOrchestrator } from '@/lib/trust/trustOrchestrator';

interface CompletionTrustSummaryProps {
  ticket: any;
  onFeedbackSubmit?: (rating: number, comment: string) => void;
}

export const CompletionTrustSummary = ({
  ticket,
  onFeedbackSubmit
}: CompletionTrustSummaryProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onFeedbackSubmit) {
      onFeedbackSubmit(rating, comment);
    }
  };

  // Use the orchestration to potentially get additional trust messaging for completion
  const orchestrator = new TrustOrchestrator();
  const contextInput = {
    ticket: ticket,
    slaSnapshot: ticket?.sla_snapshot,
    partStatus: {
      required: false,
      status: 'not_needed' as const
    },
    customerFeedbackState: 'pending' as const
  };

  const orchestrationResult = orchestrator.orchestrateTrust(contextInput);

  // Determine completion title based on SLA performance
  const getCompletionTitle = () => {
    if (ticket?.sla_snapshot?.status === 'fulfilled') {
      return 'Repair Completed Successfully - On Time!';
    } else if (ticket?.sla_snapshot?.status === 'breached') {
      return 'Repair Completed - Thank You for Your Patience';
    }
    return 'Repair Completed Successfully!';
  };

  // Determine completion message based on SLA performance
  const getCompletionMessage = () => {
    if (ticket?.sla_snapshot?.status === 'fulfilled') {
      return `Your ${ticket.device_category} has been repaired and delivered on time as promised.`;
    } else if (ticket?.sla_snapshot?.status === 'breached') {
      return `Your ${ticket.device_category} has been repaired. We appreciate your patience during the delay.`;
    }
    return `Your ${ticket.device_category} has been repaired.`;
  };

  return (
    <Card className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-green-200 dark:border-green-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          {getCompletionTitle()}
        </CardTitle>
        <CardDescription>
          {getCompletionMessage()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completion Time</p>
              <p className="font-medium">
                {ticket.created_at && ticket.updated_at ?
                  `${Math.ceil((new Date(ticket.updated_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60))} hours`
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">SLA Status</p>
              <p className="font-medium">
                {ticket.sla_snapshot?.status === 'fulfilled' ? 'Completed On Time' : 'Completed'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-600" />
            How was your experience?
          </h4>
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`p-1 ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                onClick={() => setRating(star)}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your feedback about the repair service..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              rows={3}
            />
            <button
              type="submit"
              disabled={rating === 0}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Feedback
            </button>
          </form>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Quality Assured</Badge>
            <Badge variant="secondary">Warranty Protected</Badge>
            <Badge variant="secondary">Customer Satisfaction</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};