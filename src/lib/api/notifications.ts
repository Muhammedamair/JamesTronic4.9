import { createClient } from '@/utils/supabase/client';
import {
    NotificationTemplate,
    NotificationLog,
    notificationTemplateSchema,
    notificationLogSchema
} from '@/lib/types/notifications';
import { z } from 'zod';

const supabase = createClient();

export const notificationsApi = {

    // =========================================================================
    // TEMPLATES & RULES
    // =========================================================================

    getTemplates: async (): Promise<NotificationTemplate[]> => {
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .eq('is_active', true)
            .order('stage');
        if (error) throw new Error(error.message);
        return z.array(notificationTemplateSchema).parse(data);
    },

    getNextTemplateId: async (stage: string, sentiment: string = 'neutral'): Promise<string | null> => {
        const { data, error } = await supabase.rpc('rpc_get_next_message_rule', {
            p_stage: stage,
            p_sentiment: sentiment
        });
        if (error) throw new Error(error.message);
        return data as string | null;
    },

    getTemplateById: async (id: string): Promise<NotificationTemplate | null> => {
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw new Error(error.message);
        return notificationTemplateSchema.parse(data);
    },

    // =========================================================================
    // SENDING & LOGGING
    // =========================================================================

    getLogs: async (): Promise<NotificationLog[]> => {
        const { data, error } = await supabase
            .from('notification_logs')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(50);
        if (error) throw new Error(error.message);
        return z.array(notificationLogSchema).parse(data);
    },

    simulateSend: async (
        stage: string,
        recipientId: string | null = null, // In simulation often null/dummy
        customerName: string,
        sentiment: string = 'neutral'
    ): Promise<NotificationLog> => {
        // 1. Get Template
        const templateId = await notificationsApi.getNextTemplateId(stage, sentiment);
        if (!templateId) throw new Error('No matching template found');

        const template = await notificationsApi.getTemplateById(templateId);
        if (!template) throw new Error('Template not found');

        // 2. Render Content (Simulated)
        const render = template.content_template.replace('{{customer_name}}', customerName).replace('{{ticket_id}}', 'TKT-SIM-01');

        // 3. Log it
        const { data, error } = await supabase.rpc('rpc_log_notification', {
            p_ticket_id: null, // Simulation
            p_recipient_id: recipientId,
            p_content: render,
            p_channel: template.channel,
            p_template_id: template.id
        });

        if (error) throw new Error(error.message);

        // Return the log entry just created
        const { data: logData, error: logError } = await supabase
            .from('notification_logs')
            .select('*')
            .eq('id', data)
            .single();

        if (logError) throw new Error(logError.message);
        return notificationLogSchema.parse(logData);
    }
};
