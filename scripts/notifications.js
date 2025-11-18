/**
 * Notification utility for Slack and Telegram
 */

class NotificationService {
  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  }

  async sendSlackNotification(message, status = 'info') {
    if (!this.slackWebhookUrl) {
      console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
      return;
    }

    const statusColor = {
      success: '#36a64f', // green
      failure: '#dc3545', // red
      warning: '#ffc107', // yellow
      info: '#007bff'     // blue
    }[status] || '#007bff';

    const payload = {
      text: `*JamesTronic CI/CD Notification*`,
      attachments: [
        {
          color: statusColor,
          fields: [
            {
              title: status.charAt(0).toUpperCase() + status.slice(1),
              value: message,
              short: false
            }
          ],
          footer: 'JamesTronic PWA',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      console.log('Slack notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      return false;
    }
  }

  async sendTelegramNotification(message) {
    if (!this.telegramBotToken || !this.telegramChatId) {
      console.log('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured, skipping Telegram notification');
      return;
    }

    const fullMessage = `*JamesTronic CI/CD Notification*\n\n${message}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: fullMessage,
            parse_mode: 'Markdown'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      console.log('Telegram notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      return false;
    }
  }

  async sendNotifications(message, status = 'info') {
    const results = {
      slack: await this.sendSlackNotification(message, status),
      telegram: await this.sendTelegramNotification(message)
    };

    return results;
  }
}

// Export for use in other modules
module.exports = NotificationService;

// If running directly as a script
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.error('Usage: node notifications.js <message> <status>');
      process.exit(1);
    }

    const message = args[0];
    const status = args[1] || 'info';

    const notifier = new NotificationService();
    await notifier.sendNotifications(message, status);
  })();
}