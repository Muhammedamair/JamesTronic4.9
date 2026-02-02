import { createClient } from '@/lib/supabase/server';
import { JAMES_TRONIC_CORE_PERSONA } from '@/ai-brain/core/persona';
import { GOVERNANCE_RULES, BANNED_KEYWORDS } from '@/ai-brain/core/governance';
import { ADMIN_COCKPIT_PACK } from '@/ai-brain/packs/admin-cockpit';
import { AiBrainResponse, AiRequestPayload } from '@/ai-brain/types';
import { ContextBuilderService } from './context-builder';
import { ValueFunctionService } from './value-function';
import { PolicyGuardService } from './policy-guard';

export class AiOrchestrator {

  /**
   * Main entry point to query the AI Brain.
   * Enforces Role Checks, Governance, Value Function Scoring, and Logging.
   */
  static async queryBrain(payload: AiRequestPayload): Promise<AiBrainResponse> {
    const { context, user_role, question, metrics_snapshot } = payload;

    // 1. Role Guard
    if (user_role !== 'admin') {
      throw new Error('Unauthorized: Only Admin can access the AI Brain.');
    }

    // 2. Select Brain Pack
    let pack = ADMIN_COCKPIT_PACK; // Default to Admin
    if (context !== 'admin_cockpit') {
      // Future packs would be selected here
      throw new Error(`Context ${context} not supported yet.`);
    }

    // 3. Build Enhanced Context (C15.1 Integration)
    let enhancedMetrics = metrics_snapshot || {};

    // If entity context provided, add value function scores
    if (payload.entity_type && payload.entity_id) {
      const scoringContext = await ContextBuilderService.buildContext(
        payload.entity_type,
        payload.entity_id
      );

      const valueScores = await ValueFunctionService.calculateScores(scoringContext);

      enhancedMetrics = {
        ...enhancedMetrics,
        value_scores: valueScores,
        context_signals: scoringContext.signals,
      };

      // Policy Guard Check (optional for queries, required for recommendations)
      const thresholdCheck = ValueFunctionService.meetsThresholds(valueScores);
      if (!thresholdCheck.passes) {
        console.warn('Value function thresholds not met:', thresholdCheck.failures);
        enhancedMetrics.governance_warnings = thresholdCheck.failures;
      }
    }

    // 4. Construct System Prompt
    const systemPrompt = `
${pack.system_prompt_template}

LIVE METRICS SNAPSHOT:
${JSON.stringify(enhancedMetrics, null, 2)}
`;

    // 4. Governance Check (Input)
    if (question && BANNED_KEYWORDS.some(kw => question.toLowerCase().includes(kw))) {
      throw new Error('Governance Block: Question contains banned keywords.');
    }

    try {
      // 5. Call LLM (mocking fetch for now, requires API_KEY in env)
      const aiResponse = await this.callLlmProvider(systemPrompt, question || "Generate status report.");

      // 6. Log Interaction (Fire and Forget)
      this.logInteraction(payload, aiResponse, systemPrompt).catch(console.error);

      return aiResponse;

    } catch (error) {
      console.error('AI Brain Error:', error);
      return {
        summary: 'Brain offline or unreachable.',
        opportunities: [],
        risks: ['AI Service Unavailable'],
        metrics_used: [],
        confidence_score: 0
      };
    }
  }

  /**
   * Provider-agnostic LLM caller.
   * Currently mocked to generic response if API key is missing.
   */
  private static async callLlmProvider(system: string, user: string): Promise<AiBrainResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('[AI DEBUG] ❌ Missing OPENROUTER_API_KEY in process.env');
      return this.simulateResponse();
    }

    // Actual Fetch Implementation (for OpenRouter/OpenAI)
    try {
      const modelToUse = 'qwen/qwen-2.5-7b-instruct'; // Paid but extremely cheap (~$0.00002/request)
      console.log('[AI DEBUG] 🚀 Sending request to OpenRouter with model:', modelToUse);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://jamestronic.com',
          'X-Title': 'JamesTronic'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AI DEBUG] ❌ API Request Failed:', response.status, errText);
        throw new Error(`AI Provider Failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AI DEBUG] ✅ Received response from AI');
      const content = data.choices[0].message.content;
      return JSON.parse(content) as AiBrainResponse;

    } catch (e) {
      console.error("[AI DEBUG] 💥 AI Call Exception:", e);
      return this.simulateResponse();
    }
  }

  private static simulateResponse(): AiBrainResponse {
    return {
      summary: "Simulation: The ecosystem is stable. Ticket volume is normal.",
      opportunities: ["Consider opening a Dark Store in Madhapur.", "Optimize transporter routes in Zone 3."],
      risks: ["SLA breach 5% in Secunderabad.", "Technician device conflict detected."],
      metrics_used: ["active_tickets", "sla_breaches"],
      confidence_score: 85
    };
  }

  /**
   * Logs inputs/outputs to Supabase for C40 Compliance.
   */
  private static async logInteraction(
    inputs: AiRequestPayload,
    output: AiBrainResponse,
    fullPrompt: string
  ) {
    const supabase = await createClient(); // Use server client
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from('ai_brain_logs').insert({
      user_id: user.id,
      context_type: inputs.context,
      prompt_summary: inputs.question || 'Automated Briefing',
      ai_response_summary: output.summary,
      confidence_score: output.confidence_score,
      meta_data: { full_prompt_length: fullPrompt.length, ...output }
    });
  }
}
