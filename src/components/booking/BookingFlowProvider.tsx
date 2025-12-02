/**
 * BookingFlowProvider.tsx
 *
 * React provider component to integrate the booking control & conversion layer
 * with the existing UI components in JamesTronic
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BookingFlowEngine } from '@/lib/booking/BookingFlowEngine';
import { DropOffDetector } from '@/lib/booking/DropOffDetector';
import { BookingState } from '@/lib/booking/BookingStates';
import { BookingEvent } from '@/lib/booking/EventMap';

interface BookingFlowContextType {
  bookingFlowEngine: BookingFlowEngine;
  currentBookingId: string | null;
  customerConfidence: number;
  detectedHesitationPoints: string[];
  bookingState: BookingState | null;
  initializeBooking: (bookingId: string, customerId: string, deviceType?: string, deviceBrand?: string) => Promise<boolean>;
  updateBookingState: (newState: string, reason?: string) => Promise<boolean>;
  updateCustomerConfidence: (confidence: number, hesitationPoints?: string[], riskFactors?: string[]) => Promise<void>;
  trackPageView: (pageUrl: string, viewName: string) => Promise<void>;
  completeBooking: () => Promise<boolean>;
  cancelBooking: (reason?: string) => Promise<boolean>;
}

const BookingFlowContext = createContext<BookingFlowContextType | undefined>(undefined);

interface BookingFlowProviderProps {
  children: ReactNode;
}

export const BookingFlowProvider: React.FC<BookingFlowProviderProps> = ({ children }) => {
  const [bookingFlowEngine] = useState(() => new BookingFlowEngine());
  const [dropOffDetector] = useState(() => new DropOffDetector());
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [customerConfidence, setCustomerConfidence] = useState<number>(70);
  const [detectedHesitationPoints, setDetectedHesitationPoints] = useState<string[]>([]);
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Initialize the booking engine with the drop-off detector
  useEffect(() => {
    // Additional setup if needed
  }, []);

  const initializeBooking = async (
    bookingId: string,
    customerId: string,
    deviceType?: string,
    deviceBrand?: string
  ): Promise<boolean> => {
    const result = await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      deviceType,
      deviceBrand
    );

    if (result.success) {
      setCurrentBookingId(bookingId);
      setBookingState(bookingFlowEngine.getBookingContext(bookingId)?.stateMachine.currentState || null);
      return true;
    }
    return false;
  };

  const updateBookingState = async (newStateStr: string, reason?: string): Promise<boolean> => {
    if (!currentBookingId) {
      console.warn('No active booking to update');
      return false;
    }

    // Validate that the string is a valid BookingState
    if (!Object.values(BookingState).includes(newStateStr as BookingState)) {
      console.warn(`Invalid booking state: ${newStateStr}`);
      return false;
    }

    const newState = newStateStr as BookingState;
    const result = await bookingFlowEngine.transitionBookingState(currentBookingId, newState, reason);

    if (result.success) {
      setBookingState(newState);
      return true;
    }
    return false;
  };

  const updateCustomerConfidence = async (
    confidence: number,
    hesitationPoints: string[] = [],
    riskFactors: string[] = []
  ): Promise<void> => {
    if (!currentBookingId) {
      console.warn('No active booking to update confidence for');
      return;
    }

    setCustomerConfidence(confidence);
    setDetectedHesitationPoints(hesitationPoints);

    await bookingFlowEngine.updateCustomerConfidence(
      currentBookingId,
      confidence,
      hesitationPoints,
      riskFactors
    );
  };

  const trackPageView = async (pageUrl: string, viewName: string): Promise<void> => {
    if (!currentBookingId) {
      console.warn('No active booking to track page view for');
      return;
    }

    await bookingFlowEngine.recordPageView(currentBookingId, pageUrl, viewName);
  };

  const completeBooking = async (): Promise<boolean> => {
    if (!currentBookingId) {
      console.warn('No active booking to complete');
      return false;
    }

    const result = await bookingFlowEngine.completeBookingFlow(currentBookingId);
    if (result.success) {
      setCurrentBookingId(null);
      setBookingState(null);
      return true;
    }
    return false;
  };

  const cancelBooking = async (reason?: string): Promise<boolean> => {
    if (!currentBookingId) {
      console.warn('No active booking to cancel');
      return false;
    }

    const result = await bookingFlowEngine.cancelBookingFlow(currentBookingId, reason);
    if (result.success) {
      setCurrentBookingId(null);
      setBookingState(null);
      return true;
    }
    return false;
  };

  // Track page changes automatically if we have an active booking
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (currentBookingId) {
        // Map route to view name for tracking
        let viewName = 'unknown';
        if (url.includes('/app/create')) viewName = 'booking-form';
        else if (url.includes('/app/tickets')) viewName = 'ticket-view';
        else if (url.includes('/app')) viewName = 'dashboard';
        else if (url.includes('/login')) viewName = 'login';
        else viewName = 'other';

        trackPageView(url, viewName);
      }
    };

    // For Next.js 13+ App Router, we'll use a different approach for route tracking
    // This is just a placeholder - in a real implementation we'd use router events
    const unsubscribe = () => {}; // Placeholder

    return () => {
      unsubscribe();
    };
  }, [currentBookingId]);

  const contextValue: BookingFlowContextType = {
    bookingFlowEngine,
    currentBookingId,
    customerConfidence,
    detectedHesitationPoints,
    bookingState,
    initializeBooking,
    updateBookingState,
    updateCustomerConfidence,
    trackPageView,
    completeBooking,
    cancelBooking,
  };

  return (
    <BookingFlowContext.Provider value={contextValue}>
      {children}
    </BookingFlowContext.Provider>
  );
};

export const useBookingFlow = (): BookingFlowContextType => {
  const context = useContext(BookingFlowContext);
  if (context === undefined) {
    throw new Error('useBookingFlow must be used within a BookingFlowProvider');
  }
  return context;
};