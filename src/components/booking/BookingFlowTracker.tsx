/**
 * BookingFlowTracker.tsx
 *
 * Component to automatically track booking flow progress and trigger
 * conversion optimizations at key moments in the booking process
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useBookingFlow } from './BookingFlowProvider';
import { BookingState } from '@/lib/booking/BookingStates';
import { TrustInjectionPoint } from '@/lib/booking/TrustTriggerMap';

interface BookingFlowTrackerProps {
  bookingId?: string;
  customerId?: string;
  deviceType?: string;
  deviceBrand?: string;
}

export const BookingFlowTracker: React.FC<BookingFlowTrackerProps> = ({
  bookingId,
  customerId,
  deviceType,
  deviceBrand
}) => {
  const {
    initializeBooking,
    currentBookingId,
    customerConfidence,
    detectedHesitationPoints,
    updateCustomerConfidence,
    trackPageView
  } = useBookingFlow();

  const [currentView, setCurrentView] = useState<string>('unknown');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize booking when component mounts with booking ID
  useEffect(() => {
    if (bookingId && customerId && !isInitialized) {
      initializeBooking(bookingId, customerId, deviceType, deviceBrand)
        .then(success => setIsInitialized(success));
    }
  }, [bookingId, customerId, deviceType, deviceBrand, initializeBooking, isInitialized]);

  // Track current view based on component props
  useEffect(() => {
    if (bookingId) {
      let viewName = 'unknown';
      if (currentView.includes('create') || currentView.includes('booking')) viewName = 'booking-form';
      else if (currentView.includes('tickets') || currentView.includes('track')) viewName = 'ticket-view';
      else if (currentView.includes('dashboard') || currentView.includes('app')) viewName = 'dashboard';
      else if (currentView.includes('login')) viewName = 'login';
      else viewName = currentView;

      trackPageView(window.location.pathname, viewName);
    }
  }, [currentView, bookingId, trackPageView]);

  // Monitor customer confidence changes and hesitation points
  useEffect(() => {
    if (currentBookingId && (customerConfidence < 60 || detectedHesitationPoints.length > 0)) {
      // Trigger conversion optimization when confidence drops or hesitation is detected
      updateCustomerConfidence(customerConfidence, detectedHesitationPoints, []);
    }
  }, [currentBookingId, customerConfidence, detectedHesitationPoints, updateCustomerConfidence]);

  // Render nothing - this component is for tracking and optimization only
  return null;
};

// Hook to access booking flow tracking capabilities from other components
export const useBookingFlowTracking = () => {
  const {
    updateBookingState,
    updateCustomerConfidence,
    trackPageView,
    bookingState
  } = useBookingFlow();

  const reportHesitation = async (hesitationPoints: string[], riskFactors: string[] = []) => {
    // Get current confidence level or default to a lower value when hesitation is detected
    const currentConfidence = 70 - (hesitationPoints.length * 10); // Reduce confidence based on number of hesitation points

    await updateCustomerConfidence(
      Math.max(20, currentConfidence), // Ensure confidence doesn't go below 20
      hesitationPoints,
      riskFactors
    );
  };

  const trackConversionOptimization = async (optimizationType: string) => {
    // In a real implementation, this would track specific conversion optimization events
    console.log(`Conversion optimization triggered: ${optimizationType}`);
  };

  const checkBookingStateForTrustInjection = (): TrustInjectionPoint | null => {
    if (!bookingState) return null;

    switch (bookingState) {
      case BookingState.VALIDATING:
        return TrustInjectionPoint.BOOKING_VALIDATION;
      case BookingState.TECHNICIAN_MATCH:
        return TrustInjectionPoint.TECHNICIAN_ASSIGNMENT;
      case BookingState.ASSIGNED:
        return TrustInjectionPoint.TECHNICIAN_ASSIGNMENT;
      case BookingState.CONFIRMED:
        return TrustInjectionPoint.SLA_VIEW;
      default:
        return null;
    }
  };

  return {
    updateBookingState,
    updateCustomerConfidence,
    trackPageView,
    reportHesitation,
    trackConversionOptimization,
    currentBookingState: bookingState,
    checkBookingStateForTrustInjection,
  };
};