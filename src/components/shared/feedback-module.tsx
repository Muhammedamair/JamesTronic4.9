'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle } from 'lucide-react';
import { customerAPI } from '@/lib/api/customer';
import { Ticket } from '@/lib/api/customer';

interface FeedbackModuleProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`text-2xl focus:outline-none ${star <= rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
            }`}
          onClick={() => onRatingChange(star)}
          aria-label={`Rate ${star} stars`}
        >
          <Star className="w-8 h-8 fill-current" />
        </button>
      ))}
    </div>
  );
};

export const FeedbackModule = ({ ticket, open, onOpenChange, onSuccess }: FeedbackModuleProps) => {
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setRating(0);
      setReview('');
      setSubmitted(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await customerAPI.submitFeedback(ticket.id, rating, review);
      setSubmitted(true);

      // Call success callback after a delay
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Thank You!
            </DialogTitle>
            <DialogDescription>
              Your feedback has been submitted successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-lg font-medium">We appreciate your feedback!</p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Your rating and review help us improve our service.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            Please share your feedback about the repair service for your {ticket.device_category} {ticket.brand && `- ${ticket.brand}`} {ticket.model && `- ${ticket.model}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-medium mb-3">How was your experience?</h3>
            <StarRating rating={rating} onRatingChange={setRating} />
          </div>

          <div>
            <label htmlFor="review" className="block text-sm font-medium mb-2">
              Additional comments (optional)
            </label>
            <Textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Component to automatically prompt for feedback when a ticket is completed/closed
export const TicketFeedbackPrompt = ({ ticket }: { ticket: Ticket }) => {
  const [open, setOpen] = useState(false);

  // Show feedback prompt if ticket is completed/closed and user hasn't provided feedback yet
  // Mock function to check if feedback exists for a ticket
  const hasSubmittedFeedback = (ticketId: string): boolean => {
    // In a real implementation, this would check the feedback table
    // For now, just return false to always show the prompt
    return false;
  };

  useEffect(() => {
    if (
      (ticket.status === 'Completed' || ticket.status === 'Closed' || ticket.status === 'Delivered') &&
      !hasSubmittedFeedback(ticket.id) // This would need a proper implementation to check if feedback exists
    ) {
      // In a real implementation, you'd check if feedback exists for this ticket
      // For now, we'll just show after a small delay
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000); // Show after 1 second for demo purposes

      return () => clearTimeout(timer);
    }
  }, [ticket]);



  return (
    <FeedbackModule
      ticket={ticket}
      open={open}
      onOpenChange={setOpen}
    />
  );
};