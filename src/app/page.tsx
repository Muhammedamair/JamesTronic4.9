'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSupabase } from '@/components/shared/supabase-provider';
import MyRepairsPanel from '@/components/customer/my-repairs-panel';
import { useCustomerRealtimeSync } from '@/components/customer/customer-realtime-sync';
import { TrustHeroStrip } from '@/components/trust/trust-hero-strip';
import { TruthPromiseBlock } from '@/components/trust/truth-promise-block';
import { ProofGrid } from '@/components/shared/proof-grid';
import { TrustBadgesRow } from '@/components/trust/trust-badges-row';
import { BookingReassurancePanel } from '@/components/booking/booking-reassurance-panel';
import { PersistentTrustStrip } from '@/components/trust/persistent-trust-strip';
import { useState } from 'react';
import { TicketTimelineDrawer } from '@/components/shared/ticket-timeline-drawer';

export default function CustomerPortalPage() {
  const { user, isLoading } = useSupabase();
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  // Initialize customer realtime sync
  useCustomerRealtimeSync();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
                Welcome to JamesTronic
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                Electronic Repair Services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-gray-800 dark:text-white">TV Repair</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">All sizes & brands</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-gray-800 dark:text-white">Mobile Repair</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Smartphones & tablets</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-gray-800 dark:text-white">Laptop Repair</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">All models supported</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <h3 className="font-semibold text-gray-800 dark:text-white">Appliances</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Microwave & others</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      {/* Trust components for homepage */}
      <TrustHeroStrip />
      <TrustBadgesRow />

      <div className="max-w-4xl mx-auto py-8">
        {/* Persistent Trust Strip - for customers with active tickets */}
        <div className="mb-4">
          <PersistentTrustStrip
            onShowDetails={() => {
              // Find the active ticket to show in the drawer
              // This would typically come from the customer provider
              // For now, we'll skip showing the drawer on the homepage
            }}
          />
        </div>

        {/* Truth Promise Block */}
        <TruthPromiseBlock />

        {/* Proof Grid - shows service metrics */}
        <ProofGrid />

        {/* Customer-specific panel - only shown if user is a customer */}
        <div className="mb-8">
          <MyRepairsPanel
            onTicketSelect={(ticket: any) => {
              setSelectedTicket(ticket);
              setShowTicketDetails(true);
            }}
          />
        </div>

        {/* Original content */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
              Welcome to JamesTronic
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
              Electronic Repair Services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-8">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Book your repair service easily and track your device status in real-time.
              </p>

              {!user ? (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Sign up to book your service or login to track your existing repairs.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button asChild>
                      <Link href="/login">Sign In</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/login">Create Account</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Welcome back! You can book a new service or track your existing repairs.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button asChild>
                      <Link href="/app">My Dashboard</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              {user ? (
                // Authenticated user - direct to booking
                <>
                  <Link href="/app/create?category=television" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">TV Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">All sizes & brands</p>
                  </Link>
                  <Link href="/app/create?category=mobile" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Mobile Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Smartphones & tablets</p>
                  </Link>
                  <Link href="/app/create?category=laptop" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Laptop Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">All models supported</p>
                  </Link>
                  <Link href="/app/create?category=microwave" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Appliances</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Microwave & others</p>
                  </Link>
                </>
              ) : (
                // Unauthenticated user - redirect to OTP login
                <>
                  <Link href="/login?redirect=/app/create?category=television" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">TV Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">All sizes & brands</p>
                  </Link>
                  <Link href="/login?redirect=/app/create?category=mobile" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Mobile Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Smartphones & tablets</p>
                  </Link>
                  <Link href="/login?redirect=/app/create?category=laptop" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Laptop Repair</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">All models supported</p>
                  </Link>
                  <Link href="/login?redirect=/app/create?category=microwave" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-800 dark:text-white">Appliances</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Microwave & others</p>
                  </Link>
                </>
              )}
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-700 dark:text-gray-300">
                Get your device fixed quickly with our expert technicians.
                We provide quality service with a satisfaction guarantee.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Booking Reassurance Panel */}
        <BookingReassurancePanel />
      </div>

      {/* Ticket Timeline Drawer for ticket details */}
      {selectedTicket && (
        <TicketTimelineDrawer
          ticket={selectedTicket}
          open={showTicketDetails}
          onOpenChange={setShowTicketDetails}
        />
      )}
    </div>
  );
}