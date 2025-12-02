// Test component to validate trust components integration
// This is just for testing purposes and will be removed after validation
'use client';

import { TrustPanel } from '@/components/trust/trust-panel';
import { TimelineBadgeRow } from '@/components/shared/timeline-badge-row';
import { ConfidenceBanner } from '@/components/trust/confidence-banner';

export const TrustComponentsTest = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Trust Components Test</h1>

      <div className="border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">TrustPanel Component</h2>
        <TrustPanel
          ticketId="test-ticket-123"
          slaStatus="active"
          promisedHours={24}
          elapsedHours={5}
          assignedTechnician={true}
          partRequired={false}
          confidenceLevel="high"
          status="in_progress"
        />
      </div>

      <div className="border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">TimelineBadgeRow Component</h2>
        <TimelineBadgeRow
          ticketId="test-ticket-123"
          verified={true}
          timeBound={true}
          slaProtected={true}
          technicianConfirmed={true}
          stageProgress="in_progress"
          isSLARisk={false}
          partStatus="none"
        />
      </div>

      <div className="border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">ConfidenceBanner Component (Normal)</h2>
        <ConfidenceBanner
          ticketId="test-ticket-123"
          slaStatus="active"
          partStatus="none"
          show={false}
        />
        <p className="mt-2 text-gray-600">Banner not shown when show=false</p>
      </div>

      <div className="border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">ConfidenceBanner Component (At Risk)</h2>
        <ConfidenceBanner
          ticketId="test-ticket-123"
          slaStatus="at_risk"
          partStatus="none"
          show={true}
          newETA="2025-11-28T14:30:00"
        />
      </div>
    </div>
  );
};