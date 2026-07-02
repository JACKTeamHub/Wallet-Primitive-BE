import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Processor('email-delivery')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter | null = null;

  async process(job: Job<any, any, string>): Promise<any> {
    const { type, email, otp } = job.data;
    this.logger.log(
      `[EmailProcessor] Processing job ${job.id} of type "${type}" for ${email}`,
    );

    // Lazy load/init SMTP transporter
    if (!this.transporter) {
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const secure = process.env.SMTP_SECURE === 'true';

      if (host && port && user && pass) {
        this.logger.log(
          `[EmailProcessor] Initializing custom production SMTP transporter: ${host}:${port}`,
        );
        this.transporter = nodemailer.createTransport({
          host,
          port: parseInt(port, 10),
          secure,
          auth: { user, pass },
        });
      } else {
        this.logger.log(
          '[EmailProcessor] Custom SMTP settings not fully defined. Creating Ethereal SMTP test account...',
        );
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log(
          `[EmailProcessor] Ethereal SMTP transporter created successfully. User: ${testAccount.user}`,
        );
      }
    }

    let subject = '';
    let htmlContent = '';

    if (type === 'verification') {
      subject = 'Welcome to Wallet-Primitive! Verify your email';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px; font-weight: bold;">Wallet-Primitive</h1>
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">Secure Fintech Wallet Infrastructure</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">Welcome to Wallet-Primitive! We are excited to help you launch your ledger infrastructure.</p>
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">To verify your developer account and activate your workspace, please use the following one-time password (OTP):</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #111827; background-color: #f3f4f6; padding: 10px 25px; border-radius: 6px; border: 1px dashed #d1d5db;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">This OTP is valid for 15 minutes. If you did not sign up for Wallet-Primitive, please ignore this email.</p>
        </div>
      `;
    } else {
      subject = 'Security Alert: Your One-Time Password (OTP)';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px; font-weight: bold;">Wallet-Primitive</h1>
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">Security Verification</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">A login attempt or sensitive action was initiated on your Wallet-Primitive account.</p>
          <p style="color: #374151; font-size: 16px; line-height: 1.5;">Use the one-time password below to authorize this request:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #dc2626; background-color: #fef2f2; padding: 10px 25px; border-radius: 6px; border: 1px dashed #fca5a5;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">This code will expire in 10 minutes. If you did not request this, please change your password immediately.</p>
        </div>
      `;
    }

    const info = await this.transporter.sendMail({
      from: '"Wallet-Primitive Security" <security@wallet-primitive.io>',
      to: email,
      subject,
      html: htmlContent,
    });

    this.logger.log(
      `[EmailProcessor] Email sent successfully. Message ID: ${info.messageId}`,
    );

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      this.logger.log(
        `[EmailProcessor] 📬 Preview Ethereal email here: ${previewUrl}`,
      );
    }

    return { messageId: info.messageId, previewUrl };
  }
}
