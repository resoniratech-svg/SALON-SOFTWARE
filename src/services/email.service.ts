import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailDeliveryOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDeliveryResult {
  sent: boolean;
  channel: 'EMAIL';
  recipient: string;
  status: 'DELIVERED' | 'FAILED' | 'SMTP_NOT_CONFIGURED';
  note?: string;
  messageId?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  public isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    this.initTransporter();
    if (!this.transporter) {
      return { success: false, message: 'SMTP is not configured in environment variables' };
    }
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection verified successfully' };
    } catch (err: any) {
      return { success: false, message: `SMTP verification failed: ${err.message}` };
    }
  }

  async sendMail(options: EmailDeliveryOptions): Promise<EmailDeliveryResult> {
    this.initTransporter();
    if (!this.transporter || !this.isConfigured()) {
      return {
        sent: false,
        channel: 'EMAIL',
        recipient: options.to,
        status: 'SMTP_NOT_CONFIGURED',
        note: 'SMTP service not configured in environment.',
      };
    }

    try {
      const from = process.env.SMTP_FROM || `"QUBEXE SALOON SOFTWARE" <${process.env.SMTP_USER}>`;
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        sent: true,
        channel: 'EMAIL',
        recipient: options.to,
        status: 'DELIVERED',
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error('Failed to send email via SMTP:', err);
      return {
        sent: false,
        channel: 'EMAIL',
        recipient: options.to,
        status: 'FAILED',
        note: err.message,
      };
    }
  }

  async sendTemporaryPassword(recipientEmail: string, username: string, temporaryPassword: string): Promise<EmailDeliveryResult> {
    const subject = 'QUBEXE SALOON SOFTWARE — Your Temporary Password';
    const text = `Hello ${username},\n\nA temporary password has been generated for your account:\n\nTemporary Password: ${temporaryPassword}\n\nFor security reasons, you will be required to change your password immediately upon your first login.\n\nBest regards,\nQUBEXE SALOON SOFTWARE Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">QUBEXE SALOON SOFTWARE</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>A temporary password has been generated for your account:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #111827; text-align: center; margin: 20px 0;">
          ${temporaryPassword}
        </div>
        <p style="color: #dc2626; font-size: 14px;"><strong>Note:</strong> You will be required to change your password immediately upon your first login.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280;">If you did not request this, please contact your salon administrator immediately.</p>
      </div>
    `;

    return this.sendMail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
