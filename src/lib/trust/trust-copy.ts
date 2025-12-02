// Trust Copy - Faith-Text Microcopy for Customer Trust Interface
// These are calm, honest sentences that build confidence without marketing language

export const TRUST_COPY = {
  // General trust statements
  general: {
    proactive: "We update you before you ask.",
    transparency: "No silence. No guessing.",
    protection: "Your time is protected here.",
    accountability: "We're accountable for every step.",
    certainty: "What you see is what's happening.",
    communication: "We reach out before issues arise."
  },

  // SLA related
  sla: {
    within: "You are inside SLA window",
    buffer: (hours: number) => `You have ${hours} hours buffer remaining`,
    risk: "We're working to keep your repair on track",
    breached: "We're taking extra steps to complete this repair",
    fulfilled: "Repair completed on time"
  },

  // Status related
  status: {
    traveling: "Technician traveling to location",
    waitingPart: "Waiting for part to arrive",
    underRepair: "Device is under repair",
    qualityCheck: "Quality check in progress",
    readyDelivery: "Ready for delivery"
  },

  // Part related
  parts: {
    ordered: "Part ordered: YES",
    confirmed: "Supplier confirmed",
    expected: (date: string) => `Expected: ${date}`,
    delay: "We're tracking this part closely"
  },

  // Assignment related
  assignment: {
    confirmed: "Technician confirmed",
    pending: "Assigning the right technician",
    expert: "Specialized technician assigned"
  },

  // Confidence indicators
  confidence: {
    high: "HIGH confidence in timeline",
    medium: "MEDIUM confidence in timeline",
    low: "LOW confidence - taking extra precautions"
  },

  // Delay honesty
  delay: {
    explanation: "We're delayed. Here's why.",
    accountability: "We're accountable.",
    newETA: (date: string) => `New ETA: ${date}`
  },

  // Trust markers
  markers: {
    noHiddenCharges: "No hidden charges",
    repairTracked: "Repair log tracked",
    escalationActive: "Escalation active",
    supportAlerted: "Support auto-alerted"
  },

  // Failure mode UX
  failure: {
    systemChecking: "System checking...",
    stillSyncing: "Still syncing...",
    noAction: "No action needed from you."
  }
};

// Function to get appropriate copy based on state
export const getTrustCopy = <T extends keyof typeof TRUST_COPY>(
  category: T,
  key: keyof (typeof TRUST_COPY)[T],
  ...args: any[]
) => {
  const categoryCopy = TRUST_COPY[category];
  if (categoryCopy && typeof categoryCopy[key as keyof typeof categoryCopy] === 'function') {
    return (categoryCopy[key as keyof typeof categoryCopy] as Function)(...args);
  }
  return categoryCopy?.[key as keyof typeof categoryCopy] || '';
};