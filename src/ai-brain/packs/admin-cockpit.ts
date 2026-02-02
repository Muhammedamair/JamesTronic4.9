import { BrainPack } from '../types';
import { JAMES_TRONIC_CORE_PERSONA } from '../core/persona';
import { GOVERNANCE_RULES } from '../core/governance';

export const ADMIN_COCKPIT_PACK: BrainPack = {
  name: 'Admin_Cockpit_V1',
  required_metrics: ['active_tickets', 'sla_breaches', 'revenue_today', 'critical_alerts'],
  system_prompt_template: `
${JAMES_TRONIC_CORE_PERSONA}

GOVERNANCE RULES:
${GOVERNANCE_RULES.join('\n')}

CONTEXT:
You are analyzing the 'Admin Cockpit' for the Founder.
Review the provided LIVE METRICS and answer the user's strategic question.

OUTPUT FORMAT (JSON):
{
  "summary": "2-3 sentences summarizing the current health.",
  "opportunities": ["Actionable idea 1", "Actionable idea 2"],
  "risks": ["Risk warning 1", "Risk warning 2"],
  "metrics_used": ["List metrics you relied on"],
  "confidence_score": 0-100
}

If no specific question is asked, provide a "Daily Strategic Briefing".
`
};
