/**
 * DropOffDetector.ts
 * 
 * Drop-Off Detection System for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 * 
 * Detects when customers abandon, bounce from, or hesitate in booking flows
 */

import { BookingState } from './BookingStates';

export interface DropOffDetectionConfig {
  // Time thresholds for different detection types (in milliseconds)
  abandonedFlowTimeout: number;    // Time after which flow is considered abandoned
  bouncedCheckThreshold: number;   // Number of pricing checks before considered bounced
  hesitationTimeout: number;       // Time for hesitation detection
  
  // Tracking settings
  enableSessionTracking: boolean;
  enablePageTracking: boolean;
  enableUserBehaviorTracking: boolean;
  
  // Notification settings
  notifyOnDropOff: boolean;
  notifyOnBounce: boolean;
  notifyOnHesitation: boolean;
}

export interface PageVisitRecord {
  pageUrl: string;
  timestamp: Date;
  bookingState: BookingState;
  confidenceScore: number; // Customer confidence at time of visit (0-100)
  previousPage?: string;
}

export interface UserSessionRecord {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  pagesVisited: PageVisitRecord[];
  bookingStateHistory: BookingState[];
  confidenceTrend: number[]; // Array of confidence scores over time
  isComplete: boolean;
  isDroppedOff: boolean;
  isBounced: boolean;
  detectedRiskFactors: string[];
}

export interface DropOffEvent {
  type: 'abandoned' | 'bounced' | 'hesitated' | 'bounce_attempt';
  sessionId: string;
  timestamp: Date;
  bookingState: BookingState;
  context: string;
  riskFactors: string[];
}

export interface DropOffDetectionResult {
  isDropOffDetected: boolean;
  type: 'abandoned' | 'bounced' | 'hesitated' | 'bounce_attempt' | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // Confidence in detection (0-100)
  details: string;
  event?: DropOffEvent;
}

export class DropOffDetector {
  private config: DropOffDetectionConfig;
  private activeSessions: Map<string, UserSessionRecord>;
  private detectionEvents: DropOffEvent[];
  
  constructor(config?: Partial<DropOffDetectionConfig>) {
    this.config = {
      abandonedFlowTimeout: 5 * 60 * 1000, // 5 minutes
      bouncedCheckThreshold: 3, // 3 pricing check attempts
      hesitationTimeout: 30 * 1000, // 30 seconds
      enableSessionTracking: true,
      enablePageTracking: true,
      enableUserBehaviorTracking: true,
      notifyOnDropOff: true,
      notifyOnBounce: true,
      notifyOnHesitation: true,
      ...config
    };
    
    this.activeSessions = new Map();
    this.detectionEvents = [];
  }
  
  /**
   * Starts tracking a user session for a booking
   */
  startSession(sessionId: string, bookingState: BookingState): void {
    if (!this.config.enableSessionTracking) return;
    
    const sessionRecord: UserSessionRecord = {
      sessionId,
      startTime: new Date(),
      pagesVisited: [],
      bookingStateHistory: [bookingState],
      confidenceTrend: [],
      isComplete: false,
      isDroppedOff: false,
      isBounced: false,
      detectedRiskFactors: [],
    };
    
    this.activeSessions.set(sessionId, sessionRecord);
  }
  
  /**
   * Records a page visit in the current session
   */
  recordPageVisit(
    sessionId: string, 
    pageUrl: string, 
    bookingState: BookingState, 
    confidenceScore: number
  ): void {
    if (!this.config.enablePageTracking) return;
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for page visit tracking`);
      return;
    }
    
    const previousPage = session.pagesVisited.length > 0 
      ? session.pagesVisited[session.pagesVisited.length - 1].pageUrl 
      : undefined;
    
    const pageRecord: PageVisitRecord = {
      pageUrl,
      timestamp: new Date(),
      bookingState,
      confidenceScore,
      previousPage,
    };
    
    session.pagesVisited.push(pageRecord);
    session.bookingStateHistory.push(bookingState);
    session.confidenceTrend.push(confidenceScore);
    
    // Check for bounce behavior (multiple visits to pricing page)
    if (pageUrl.includes('pricing') || pageUrl.includes('checkout')) {
      const pricingVisits = session.pagesVisited.filter(p => 
        p.pageUrl.includes('pricing') || p.pageUrl.includes('checkout')
      ).length;
      
      if (pricingVisits >= this.config.bouncedCheckThreshold) {
        session.isBounced = true;
        this.recordDetectionEvent(sessionId, bookingState, 'bounce_attempt', 'Bounce behavior detected');
      }
    }
  }
  
  /**
   * Records a booking state change
   */
  recordBookingStateChange(sessionId: string, newState: BookingState): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    session.bookingStateHistory.push(newState);
  }
  
  /**
   * Records customer confidence level
   */
  recordConfidence(sessionId: string, confidence: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    session.confidenceTrend.push(confidence);
  }
  
  /**
   * Records a risk factor detected during the session
   */
  recordRiskFactor(sessionId: string, riskFactor: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    if (!session.detectedRiskFactors.includes(riskFactor)) {
      session.detectedRiskFactors.push(riskFactor);
    }
  }
  
  /**
   * Checks if a drop-off event has occurred for a session
   */
  checkDropOff(sessionId: string): DropOffDetectionResult {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        isDropOffDetected: false,
        type: null,
        riskLevel: 'low',
        confidence: 0,
        details: 'Session not found',
      };
    }
    
    // Check for abandonment (session inactive beyond timeout)
    if (session.pagesVisited.length > 0) {
      const lastVisit = session.pagesVisited[session.pagesVisited.length - 1];
      const timeSinceLastVisit = Date.now() - lastVisit.timestamp.getTime();
      
      if (timeSinceLastVisit > this.config.abandonedFlowTimeout && !session.isComplete) {
        session.isDroppedOff = true;
        const event = this.recordDetectionEvent(
          sessionId, 
          lastVisit.bookingState, 
          'abandoned', 
          `User inactive for ${timeSinceLastVisit}ms`
        );
        
        return {
          isDropOffDetected: true,
          type: 'abandoned',
          riskLevel: 'high',
          confidence: 90,
          details: `Session abandoned after ${timeSinceLastVisit}ms of inactivity`,
          event,
        };
      }
    }
    
    // Check for bounce behavior
    if (session.isBounced) {
      const pricingVisits = session.pagesVisited.filter(p => 
        p.pageUrl.includes('pricing') || p.pageUrl.includes('checkout')
      ).length;
      
      if (pricingVisits >= this.config.bouncedCheckThreshold && !session.isComplete) {
        const event = this.recordDetectionEvent(
          sessionId, 
          session.bookingStateHistory[session.bookingStateHistory.length - 1], 
          'bounced', 
          `Visited pricing page ${pricingVisits} times`
        );
        
        return {
          isDropOffDetected: true,
          type: 'bounced',
          riskLevel: 'medium',
          confidence: 85,
          details: `User bounced from pricing page ${pricingVisits} times`,
          event,
        };
      }
    }
    
    // Check for hesitation (confidence dropping significantly)
    if (session.confidenceTrend.length >= 2) {
      const currentConfidence = session.confidenceTrend[session.confidenceTrend.length - 1];
      const previousConfidence = session.confidenceTrend[session.confidenceTrend.length - 2];
      const confidenceDrop = previousConfidence - currentConfidence;
      
      if (confidenceDrop > 20) { // Significant drop threshold
        const event = this.recordDetectionEvent(
          sessionId, 
          session.bookingStateHistory[session.bookingStateHistory.length - 1], 
          'hesitated', 
          `Confidence dropped from ${previousConfidence} to ${currentConfidence}`
        );
        
        return {
          isDropOffDetected: true,
          type: 'hesitated',
          riskLevel: 'medium',
          confidence: 80,
          details: `User confidence dropped by ${confidenceDrop} points`,
          event,
        };
      }
    }
    
    // Check for hesitation based on time spent in hesitation-prone states
    const currentState = session.bookingStateHistory[session.bookingStateHistory.length - 1];
    if ([BookingState.VALIDATING, BookingState.TECHNICIAN_MATCH, BookingState.ASSIGNED].includes(currentState)) {
      const stateStartTime = session.pagesVisited
        .filter(p => p.bookingState === currentState)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;
      
      if (stateStartTime) {
        const timeInState = Date.now() - stateStartTime.getTime();
        if (timeInState > this.config.hesitationTimeout) {
          const event = this.recordDetectionEvent(
            sessionId, 
            currentState, 
            'hesitated', 
            `Spent ${timeInState}ms in ${currentState} state`
          );
          
          return {
            isDropOffDetected: true,
            type: 'hesitated',
            riskLevel: 'high',
            confidence: 85,
            details: `User hesitated for ${timeInState}ms in ${currentState} state`,
            event,
          };
        }
      }
    }
    
    return {
      isDropOffDetected: false,
      type: null,
      riskLevel: 'low',
      confidence: 0,
      details: 'No drop-off detected',
    };
  }
  
  /**
   * Marks a session as complete (not a drop-off)
   */
  markSessionComplete(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    
    session.isComplete = true;
    session.endTime = new Date();
    return true;
  }
  
  /**
   * Gets all detection events for a session
   */
  getSessionEvents(sessionId: string): DropOffEvent[] {
    return this.detectionEvents.filter(event => event.sessionId === sessionId);
  }
  
  /**
   * Gets all active sessions
   */
  getActiveSessions(): UserSessionRecord[] {
    return Array.from(this.activeSessions.values());
  }
  
  /**
   * Cleans up old sessions
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const now = Date.now();
    let cleanedCount = 0;
    
    this.activeSessions.forEach((session, sessionId) => {
      if (session.endTime) {
        // Session ended, check if it's old enough to remove
        const timeSinceEnd = now - session.endTime.getTime();
        if (timeSinceEnd > maxAge) {
          this.activeSessions.delete(sessionId);
          cleanedCount++;
        }
      } else {
        // Active session, check if it's too old without activity
        const lastPageVisit = session.pagesVisited.length > 0
          ? session.pagesVisited[session.pagesVisited.length - 1].timestamp
          : session.startTime;
          
        const timeSinceLastActivity = now - lastPageVisit.getTime();
        if (timeSinceLastActivity > maxAge) {
          this.activeSessions.delete(sessionId);
          cleanedCount++;
        }
      }
    });
    
    return cleanedCount;
  }
  
  /**
   * Private method to record a detection event
   */
  private recordDetectionEvent(
    sessionId: string,
    bookingState: BookingState,
    type: 'abandoned' | 'bounced' | 'hesitated' | 'bounce_attempt',
    context: string
  ): DropOffEvent {
    const event: DropOffEvent = {
      type,
      sessionId,
      timestamp: new Date(),
      bookingState,
      context,
      riskFactors: this.activeSessions.get(sessionId)?.detectedRiskFactors || [],
    };
    
    this.detectionEvents.push(event);
    
    // Optionally notify about the event
    if (
      (type === 'abandoned' && this.config.notifyOnDropOff) ||
      (type === 'bounced' && this.config.notifyOnBounce) ||
      (type === 'hesitated' && this.config.notifyOnHesitation)
    ) {
      this.handleDropOffEvent(event);
    }
    
    return event;
  }
  
  /**
   * Handles a drop-off event (e.g., sends notification)
   */
  private handleDropOffEvent(event: DropOffEvent): void {
    console.log(`Drop-off detected: ${event.type} in session ${event.sessionId}`, event);
    
    // In a real implementation, this would trigger notifications to relevant systems
    // For example: send to notification engine, customer service, etc.
  }
  
  /**
   * Gets summary statistics about drop-off detection
   */
  getDetectionStats(): {
    totalSessions: number;
    dropOffs: number;
    bounceAttempts: number;
    hesitations: number;
    completionRate: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const completed = sessions.filter(s => s.isComplete).length;
    const droppedOff = sessions.filter(s => s.isDroppedOff).length;
    const bounced = sessions.filter(s => s.isBounced).length;
    
    const totalEvents = this.detectionEvents.length;
    const hesitationEvents = this.detectionEvents.filter(e => e.type === 'hesitated').length;
    
    return {
      totalSessions: sessions.length,
      dropOffs: droppedOff,
      bounceAttempts: bounced,
      hesitations: hesitationEvents,
      completionRate: sessions.length > 0 ? (completed / sessions.length) * 100 : 0,
    };
  }
}