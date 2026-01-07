-- ============================================================================
-- C26 Customer Notification Intelligence: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Trust-based messaging system with multi-channel support and
-- sentiment adaptation.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.notification_channel AS ENUM (
    'whatsapp',
    'sms',
    'email',
    'push',
    'in_app'
);

CREATE TYPE public.notification_tone AS ENUM (
    'standard',
    'professional',
    'empathetic',
    'urgent',
    'celebratory'
);

CREATE TYPE public.notification_stage AS ENUM (
    'booking_confirmation',
    'pickup_reminder',
    'pickup_completed',
    'repair_update',
    'sla_warning',
    'delivery_scheduled',
    'delivery_completed',
    'payment_request',
    'feedback_request'
);

CREATE TYPE public.notification_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed',
    'opted_out'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Notification Templates: Content with placeholders
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    stage public.notification_stage NOT NULL,
    channel public.notification_channel NOT NULL,
    tone public.notification_tone DEFAULT 'standard',
    
    template_name text NOT NULL,
    content_template text NOT NULL, -- "Hello {{customer_name}}, your order is..."
    
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Customer Communication Preferences
CREATE TABLE IF NOT EXISTS public.customer_communication_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
    
    whatsapp_enabled boolean DEFAULT true,
    sms_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    
    preferred_language text DEFAULT 'en', -- 'en', 'hi', 'te'
    
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id)
);

-- Trust Events: special high-level triggers
CREATE TABLE IF NOT EXISTS public.trust_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id),
    
    event_type text NOT NULL, -- 'sla_breach_risk', 'technician_delayed'
    severity text DEFAULT 'medium', -- 'low', 'medium', 'high'
    
    customer_sentiment_at_event text, -- from C24/C15
    
    triggered_at timestamptz DEFAULT now() NOT NULL
);

-- Notification Logs: History of messages
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    recipient_id uuid REFERENCES public.profiles(user_id),
    ticket_id uuid REFERENCES public.tickets(id),
    trust_event_id uuid REFERENCES public.trust_events(id),
    
    -- Content
    template_id uuid REFERENCES public.notification_templates(id),
    channel public.notification_channel NOT NULL,
    message_content text NOT NULL, -- The rendered message
    
    -- Status
    status public.notification_status DEFAULT 'pending',
    provider_message_id text, -- ID from Interakt/Twilio
    
    sent_at timestamptz DEFAULT now() NOT NULL,
    delivered_at timestamptz,
    read_at timestamptz
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_logs_recipient ON public.notification_logs(recipient_id);
CREATE INDEX idx_logs_ticket ON public.notification_logs(ticket_id);
CREATE INDEX idx_logs_status ON public.notification_logs(status);
CREATE INDEX idx_preferences_user ON public.customer_communication_preferences(user_id);

-- ============================================================================
-- SEED DATA (Templates)
-- ============================================================================

INSERT INTO public.notification_templates (stage, channel, tone, template_name, content_template)
VALUES 
    ('booking_confirmation', 'whatsapp', 'standard', 'booking_conf_std', 'Hello {{customer_name}}, thanks for choosing JamesTronic! Your repair ({{ticket_id}}) is confirmed.'),
    ('sla_warning', 'whatsapp', 'empathetic', 'sla_warn_emp', 'Hi {{customer_name}}, we noticed your repair is taking longer than expected. We deeply apologize for the delay and are prioritizing your request.'),
    ('delivery_completed', 'whatsapp', 'celebratory', 'del_comp_cel', 'Great news {{customer_name}}! Your item has been delivered. Enjoy your restored appliance!'),
    ('payment_request', 'whatsapp', 'professional', 'pay_req_pro', 'Dear {{customer_name}}, please find the invoice for your repair attached. Amount: {{amount}}.')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admin manage templates"
ON public.notification_templates FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin view all logs"
ON public.notification_logs FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

-- Customers
CREATE POLICY "Customer view own preferences"
ON public.customer_communication_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customer update own preferences"
ON public.customer_communication_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customer view own notifications"
ON public.notification_logs FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Log Notification
CREATE OR REPLACE FUNCTION public.rpc_log_notification(
    p_ticket_id uuid,
    p_recipient_id uuid,
    p_content text,
    p_channel text DEFAULT 'whatsapp',
    p_template_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO public.notification_logs (
        ticket_id, recipient_id, message_content, channel, template_id, status
    )
    VALUES (
        p_ticket_id, p_recipient_id, p_content, p_channel::public.notification_channel, p_template_id, 'sent'
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- RPC: Get Next Message Rule (Simple Logic)
CREATE OR REPLACE FUNCTION public.rpc_get_next_message_rule(
    p_stage text,
    p_sentiment text DEFAULT 'neutral'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_id uuid;
    v_target_tone public.notification_tone;
BEGIN
    -- Determine tone based on sentiment/stage
    IF p_stage = 'sla_warning' OR p_sentiment IN ('negative', 'frustrated') THEN
        v_target_tone := 'empathetic';
    ELSIF p_stage = 'delivery_completed' THEN
        v_target_tone := 'celebratory';
    ELSE
        v_target_tone := 'standard';
    END IF;

    -- Find matching template
    SELECT id INTO v_template_id
    FROM public.notification_templates
    WHERE stage = p_stage::public.notification_stage
      AND tone = v_target_tone
      AND is_active = true
    LIMIT 1;
    
    -- Fallback to standard if specific tone not found
    IF v_template_id IS NULL THEN
        SELECT id INTO v_template_id
        FROM public.notification_templates
        WHERE stage = p_stage::public.notification_stage
          AND tone = 'standard'
          AND is_active = true
        LIMIT 1;
    END IF;

    RETURN v_template_id;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_communication_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;

GRANT ALL ON public.notification_templates TO service_role;
GRANT ALL ON public.customer_communication_preferences TO service_role;
GRANT ALL ON public.trust_events TO service_role;
GRANT ALL ON public.notification_logs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_log_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_log_notification TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_message_rule TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_message_rule TO service_role;
