'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGuestBookingDraft } from '@/store/guestBookingDraft';

interface AuthWallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionDescription?: string;
}

export const AuthWall: React.FC<AuthWallProps> = ({
  open,
  onOpenChange,
  actionDescription = 'confirm your booking'
}) => {
  const [phone, setPhone] = useState('');
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearDraft } = useGuestBookingDraft();

  const handleSendOTP = async () => {
    if (!phone) {
      toast({
        title: 'Error',
        description: 'Please enter your phone number',
        variant: 'destructive',
      });
      return;
    }

    // Basic phone validation (Indian numbers typically start with 6-9 and are 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid 10-digit Indian phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingOTP(true);

    try {
      const formattedPhone = `+91${phone}`;

      // Call the API to send OTP
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_e164: formattedPhone,
          channel: 'whatsapp'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      // Store the phone number in session storage for the OTP page to pick up
      sessionStorage.setItem('pending_phone', formattedPhone);

      // Close the dialog and redirect to login
      onOpenChange(false);
      router.push(`/login?phone=${formattedPhone}&redirect=${encodeURIComponent('/book/confirm')}`);

      toast({
        title: 'OTP Sent',
        description: `OTP has been sent to ${formattedPhone}. Please check your messages.`,
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send OTP',
        variant: 'destructive',
      });
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleBackToEdit = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Continue with OTP</DialogTitle>
          <DialogDescription>
            Please enter your phone number to {actionDescription}. We'll send you a one-time password to verify your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm">
                +91
              </span>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                className="rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              We'll send an OTP to verify your account.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleSendOTP}
            disabled={isSendingOTP || !phone}
            className="w-full"
          >
            {isSendingOTP ? 'Sending OTP...' : 'Continue with WhatsApp OTP'}
          </Button>
          <Button
            variant="outline"
            onClick={handleBackToEdit}
            className="w-full"
          >
            Back to Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};