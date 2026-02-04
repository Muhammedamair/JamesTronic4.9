// Note: We'll handle nodemailer import dynamically in the API route due to Next.js 16 ESM/CJS issues
// This file will be updated to export a function that handles the dynamic import

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Get email configuration from environment variables
 */
function getEmailConfig(): EmailConfig | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFromEmail = process.env.SMTP_FROM_EMAIL;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFromEmail) {
    console.warn('[EMAIL SERVICE NOT CONFIGURED] SMTP variables not set, emails will be logged to console for development');
    console.warn('[EMAIL SERVICE] Please configure the following environment variables:');
    console.warn('[EMAIL SERVICE] SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL');
    console.warn('[EMAIL SERVICE] For development, OTP will be logged to console instead of being sent via email');
    return null;
  }

  return {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    from: smtpFromEmail,
  };
}

/**
 * Send an OTP email to the specified recipient
 * This function will be called from the API route where nodemailer is dynamically imported
 */
export async function sendOtpEmail(to: string, otp: string, request_id: string, transporter: any): Promise<boolean> {
  const config = getEmailConfig();

  if (!config) {
    // For development, log the OTP to console if email service is not configured
    console.log(`[EMAIL SERVICE NOT CONFIGURED] OTP for ${to} is: ${otp} (Request ID: ${request_id})`);
    return true; // Return true to indicate success in development mode
  }

  try {
    // Verify connection configuration
    await transporter.verify();

    // Email content
    const mailOptions = {
      from: config.from,
      to: to,
      subject: 'Your One-Time Password (OTP) - JamesTronic',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">JamesTronic OTP Verification</h2>
          <p>Hello,</p>
          <p>Your one-time password (OTP) for JamesTronic account verification is:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; background-color: #f3f4f6; padding: 10px 20px; border-radius: 5px; letter-spacing: 3px; color: #1f2937;">
              ${otp}
            </span>
          </div>
          <p>This OTP is valid for 10 minutes. Please use it to complete your verification process.</p>
          <p>If you did not request this OTP, please ignore this email.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            This is an automated message from JamesTronic. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] OTP sent successfully to ${to} (Request ID: ${request_id}) - Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send OTP to ${to} (Request ID: ${request_id}):`, error);
    return false;
  }
}

/**
 * Create a nodemailer transporter
 * This function will be called from the API route where nodemailer is dynamically imported
 */
export async function createTransporter(): Promise<any> {
  // Dynamic import of nodemailer happens in the API route
  // This function will be called with the imported nodemailer
  return null;
}

/**
 * Send a test email to verify email configuration
 * This function will be called from the API route where nodemailer is dynamically imported
 */
export async function sendTestEmail(to: string, request_id: string, transporter: any): Promise<boolean> {
  const config = getEmailConfig();

  if (!config) {
    console.log('[EMAIL SERVICE NOT CONFIGURED] Cannot send test email - SMTP variables not set');
    return false;
  }

  try {
    await transporter.verify();

    const mailOptions = {
      from: config.from,
      to: to,
      subject: 'JamesTronic Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">JamesTronic Email Test</h2>
          <p>Hello,</p>
          <p>This is a test email to confirm that your email configuration is working correctly.</p>
          <p>If you received this email, your SMTP settings are properly configured.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            This is an automated message from JamesTronic. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Test email sent successfully to ${to} - Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send test email to ${to}:`, error);
    return false;
  }
}