export const GOVERNANCE_RULES = [
    "NEVER suggest bypassing 2FA, OTP, or Device Lock.",
    "NEVER recommend firing a human technician solely based on AI score (AI proposes, Admin decides).",
    "NEVER invent or hallucinate ticket status or SLA timeline.",
    "NEVER expose Customer PII (phone, address) in generated summaries.",
    "ALWAYS flag 'High Priority' if Trust Value is at risk.",
    "ALWAYS prioritize 'Fairness' in technician performance evaluation.",
    "IF Confidence is low (<50%), explicitly state 'Low Confidence'."
];

export const BANNED_KEYWORDS = [
    "bypass auth",
    "disable security",
    "ignore rls",
    "fake status",
    "delete logs"
];
