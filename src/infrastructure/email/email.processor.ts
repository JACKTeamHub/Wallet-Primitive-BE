import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Processor('email-delivery')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      const { type, email, otp } = job.data;
      this.logger.log(
        `[EmailProcessor] Processing job ${job.id} of type "${type}" for ${email}`,
      );

      const from = this.configService.get<string>('SMTP_FROM');
      const host = this.configService.get<string>('SMTP_HOST');
      const port = this.configService.get<number>('SMTP_PORT');
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');

      if (!host || !user || !pass || !from) {
        throw new Error(
          'SMTP credentials (host, user, pass, from) are missing in environment variables. Please configure them in your settings.',
        );
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

      this.logger.log(`[EmailProcessor] Sending email via SMTP to ${email}`);

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user,
          pass,
        },
      });

      const info = await transporter.sendMail({
        from,
        to: email,
        subject,
        html: htmlContent,
      });

      const messageId = info.messageId;
      this.logger.log(
        `[EmailProcessor] Email sent successfully via SMTP. Message ID: ${messageId}`,
      );

      return { messageId };
    } catch (err: any) {
      this.logger.error(
        `[EmailProcessor] Job ${job.id} failed: ${err.message}`,
      );

      // Clean up unverified user if email delivery fails after 3 attempts
      const { type, email } = job.data;
      const attemptsMade = job.attemptsMade || 0;
      if (type === 'verification' && attemptsMade >= 2) {
        this.logger.warn(
          `[EmailProcessor] Verification email failed after 3 attempts. Deleting unverified developer for ${email}.`,
        );
        try {
          const user = await this.prisma.developerUser.findUnique({
            where: { email },
          });
          if (user && !user.verified) {
            await this.prisma.workspace.delete({
              where: { id: user.workspaceId },
            });
            this.logger.log(
              `[EmailProcessor] Successfully removed unverified workspace/user slot for ${email} due to email failure.`,
            );
          }
        } catch (cleanupErr: any) {
          this.logger.error(
            `[EmailProcessor] Failed to clean up unverified user: ${cleanupErr.message}`,
          );
        }
      }

      throw err;
    }
  }
}
