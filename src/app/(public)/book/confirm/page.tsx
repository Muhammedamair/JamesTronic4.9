'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGuestBookingDraft } from '@/store/guestBookingDraft';
import { AuthWall } from '@/components/auth/AuthWall';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';

export default function BookConfirmPage() {
  const { draft, expireDraftIfNeeded, clearDraft } = useGuestBookingDraft();
  const { user } = useSupabase();
  const router = useRouter();
  const [showAuthWall, setShowAuthWall] = useState(false);

  // Check and expire draft if needed when component mounts
  useEffect(() => {
    expireDraftIfNeeded();
  }, [expireDraftIfNeeded]);

  // If user is authenticated, redirect to the booking form with pre-filled data
  useEffect(() => {
    if (user && draft) {
      // Redirect to the public booking page
      router.push('/book');
    }
  }, [user, draft, router]);

  const handleConfirmBooking = () => {
    // If not logged in, show the AuthWall
    if (!user) {
      setShowAuthWall(true);
    } else {
      // If logged in, continue with booking
      console.log('User is logged in, continuing with booking...');
      router.push('/book');
    }
  };

  const handleBackToEdit = () => {
    // For now, go back to the home page where they can select services
    router.push('/');
  };

  if (!draft) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle>No Booking Draft Found</CardTitle>
            <CardDescription>
              You don't have any booking information saved. Start by creating a new booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/')}>
              Browse Services
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Confirm Your Booking</CardTitle>
          <CardDescription>
            Review your booking details before confirming
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Service Details</h3>
              <p>Category: {draft.category || 'Not specified'}</p>
              <p>Service ID: {draft.serviceId || 'Not specified'}</p>
              <p>Service: {draft.serviceSlug || 'Not specified'}</p>
            </div>

            <div>
              <h3 className="font-semibold">Issue Details</h3>
              <ul className="list-disc pl-5">
                {draft.issues && draft.issues.length > 0 ?
                  draft.issues.map((issue, index) => <li key={index}>{issue}</li>) :
                  <li>No issues specified</li>
                }
              </ul>
            </div>

            {draft.address && (
              <div>
                <h3 className="font-semibold">Address</h3>
                <p>{draft.address.street}</p>
                <p>{draft.address.city}, {draft.address.state} {draft.address.pincode}</p>
              </div>
            )}

            {draft.timeSlot && (
              <div>
                <h3 className="font-semibold">Preferred Time Slot</h3>
                <p>Date: {draft.timeSlot.date}</p>
                <p>Time: {draft.timeSlot.time}</p>
              </div>
            )}

            {draft.pricing && (
              <div>
                <h3 className="font-semibold">Pricing</h3>
                <p>Base Price: ₹{draft.pricing.basePrice}</p>
                <p>Tax: ₹{draft.pricing.tax}</p>
                <p>Total: ₹{draft.pricing.total}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBackToEdit}>
            Back to Edit
          </Button>
          <Button onClick={handleConfirmBooking}>
            Confirm Booking
          </Button>
        </CardFooter>
      </Card>

      {/* Auth Wall Modal - Shows only when user is not authenticated */}
      <AuthWall
        open={showAuthWall}
        onOpenChange={setShowAuthWall}
        actionDescription="confirm your booking"
      />
    </div>
  );
}