import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email-delivery') private readonly emailQueue: Queue,
  ) {}

  async sendVerificationEmail(email: string, otp: string): Promise<string> {
    this.logger.log(`Queueing verification email for ${email}`);
    const job = await this.emailQueue.add(
      'send-email',
      {
        type: 'verification',
        email,
        otp,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
    return String(job.id);
  }

  async sendOtpEmail(email: string, otp: string): Promise<string> {
    this.logger.log(`Queueing login OTP email for ${email}`);
    const job = await this.emailQueue.add(
      'send-email',
      {
        type: 'otp',
        email,
        otp,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
    return String(job.id);
  }
}
