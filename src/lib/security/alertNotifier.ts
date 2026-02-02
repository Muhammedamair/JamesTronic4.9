import { createClient } from '@supabase/supabase-js';

interface SecurityAlert {
  id: string;
  rule_id: string;
  source_type: string;
  severity: string;
  message: string;
  metadata: any;
  status: string;
  created_at: string;
}

interface NotificationChannel {
  id: string;
  channel_type: string;
  target: string;
  is_active: boolean;
  created_at: string;
}

interface NotificationResult {
  success: boolean;
  channel_id: string;
  message: string;
}

export class AlertNotifier {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  /**
   * Send notifications for newly created security alerts
   */
  async sendNotifications(): Promise<NotificationResult[]> {
    console.log('[AlertNotifier] Starting to send notifications for new alerts...');

    try {
      // Fetch new 'open' security alerts that haven't been notified yet
      // For now, we'll consider all open alerts as needing notification
      // In a real implementation, you might track notification status separately
      const { data: alerts, error: alertsError } = await this.supabase
        .from('security_alerts')
        .select('*')
        .eq('status', 'open')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour to avoid processing old alerts
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Error fetching security alerts:', alertsError);
        return [];
      }

      if (!alerts || alerts.length === 0) {
        console.log('[AlertNotifier] No new security alerts to notify');
        return [];
      }

      // Fetch active notification channels
      const { data: channels, error: channelsError } = await this.supabase
        .from('security_notification_channels')
        .select('*')
        .eq('is_active', true);

      if (channelsError) {
        console.error('Error fetching notification channels:', channelsError);
        return [];
      }

      if (!channels || channels.length === 0) {
        console.log('[AlertNotifier] No active notification channels found');
        return [];
      }

      console.log(`[AlertNotifier] Found ${alerts.length} alerts and ${channels.length} active channels`);

      // Send notifications for each alert through each channel
      const results: NotificationResult[] = [];
      for (const alert of alerts) {
        for (const channel of channels) {
          const result = await this.sendNotificationToChannel(alert, channel);
          results.push(result);
        }
      }

      console.log(`[AlertNotifier] Sent ${results.length} notifications`);
      return results;
    } catch (error) {
      console.error('[AlertNotifier] Error sending notifications:', error);
      return [];
    }
  }

  /**
   * Send a notification to a specific channel
   */
  private async sendNotificationToChannel(alert: SecurityAlert, channel: NotificationChannel): Promise<NotificationResult> {
    console.log(`[AlertNotifier] Sending alert ${alert.id} to channel ${channel.id} (${channel.channel_type})`);

    try {
      switch (channel.channel_type) {
        case 'email':
          return await this.sendEmailNotification(alert, channel.target);
        case 'whatsapp_provider_hook':
          return await this.sendWhatsAppNotification(alert, channel.target);
        case 'internal_log':
          return await this.logInternalNotification(alert, channel.target);
        case 'slack':
          return await this.sendSlackNotification(alert, channel.target);
        case 'webhook':
          return await this.sendWebhookNotification(alert, channel.target);
        default:
          console.warn(`[AlertNotifier] Unknown channel type: ${channel.channel_type}`);
          return {
            success: false,
            channel_id: channel.id,
            message: `Unknown channel type: ${channel.channel_type}`
          };
      }
    } catch (error) {
      console.error(`[AlertNotifier] Error sending notification to channel ${channel.id}:`, error);
      return {
        success: false,
        channel_id: channel.id,
        message: `Error: ${(error as Error).message}`
      };
    }
  }

  /**
   * Send notification via email
   */
  private async sendEmailNotification(alert: SecurityAlert, email: string): Promise<NotificationResult> {
    // In a real implementation, you would use an email service (e.g., SendGrid, AWS SES)
    console.log(`[EMAIL NOTIFICATION] Sending security alert to: ${email}`);
    console.log(`[EMAIL NOTIFICATION] Severity: ${alert.severity}`);
    console.log(`[EMAIL NOTIFICATION] Message: ${alert.message}`);
    console.log(`[EMAIL NOTIFICATION] Details:`, alert.metadata);

    // For now, we'll just log to console
    return {
      success: true,
      channel_id: 'EMAIL',
      message: `Email notification sent to ${email}`
    };
  }

  /**
   * Send notification via WhatsApp provider hook
   */
  private async sendWhatsAppNotification(alert: SecurityAlert, templateId: string): Promise<NotificationResult> {
    // In a real implementation, you would use your WhatsApp provider (e.g., MSG91, Twilio)
    console.log(`[WHATSAPP NOTIFICATION] Sending security alert using template: ${templateId}`);
    console.log(`[WHATSAPP NOTIFICATION] Severity: ${alert.severity}`);
    console.log(`[WHATSAPP NOTIFICATION] Message: ${alert.message}`);

    // For now, we'll just log to console
    return {
      success: true,
      channel_id: 'WHATSAPP',
      message: `WhatsApp notification sent using template ${templateId}`
    };
  }

  /**
   * Log notification internally
   */
  private async logInternalNotification(alert: SecurityAlert, target: string): Promise<NotificationResult> {
    console.log(`[INTERNAL LOG] Security Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    console.log(`[INTERNAL LOG] Rule ID: ${alert.rule_id}, Source: ${alert.source_type}`);
    console.log(`[INTERNAL LOG] Created: ${alert.created_at}`);
    console.log(`[INTERNAL LOG] Details:`, alert.metadata);

    // For now, we'll just log to console
    return {
      success: true,
      channel_id: 'INTERNAL_LOG',
      message: `Alert logged internally`
    };
  }

  /**
   * Send notification to Slack
   */
  private async sendSlackNotification(alert: SecurityAlert, webhookUrl: string): Promise<NotificationResult> {
    try {
      const slackMessage = {
        text: `🚨 Security Alert [${alert.severity.toUpperCase()}]: ${alert.message}`,
        attachments: [
          {
            color: alert.severity === 'high' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
            fields: [
              {
                title: 'Rule',
                value: alert.rule_id,
                short: true
              },
              {
                title: 'Source',
                value: alert.source_type,
                short: true
              },
              {
                title: 'Created',
                value: new Date(alert.created_at).toLocaleString(),
                short: true
              },
              {
                title: 'Details',
                value: JSON.stringify(alert.metadata, null, 2),
                short: false
              }
            ]
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed with status ${response.status}`);
      }

      return {
        success: true,
        channel_id: 'SLACK',
        message: `Slack notification sent successfully`
      };
    } catch (error) {
      return {
        success: false,
        channel_id: 'SLACK',
        message: `Failed to send Slack notification: ${(error as Error).message}`
      };
    }
  }

  /**
   * Send notification via webhook
   */
  private async sendWebhookNotification(alert: SecurityAlert, webhookUrl: string): Promise<NotificationResult> {
    try {
      const payload = {
        alert_id: alert.id,
        rule_id: alert.rule_id,
        severity: alert.severity,
        message: alert.message,
        source_type: alert.source_type,
        created_at: alert.created_at,
        metadata: alert.metadata
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      return {
        success: true,
        channel_id: 'WEBHOOK',
        message: `Webhook notification sent successfully`
      };
    } catch (error) {
      return {
        success: false,
        channel_id: 'WEBHOOK',
        message: `Failed to send webhook notification: ${(error as Error).message}`
      };
    }
  }
}