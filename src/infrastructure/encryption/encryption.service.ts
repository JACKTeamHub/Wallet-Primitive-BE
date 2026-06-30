import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
    if (rawKey.length !== 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be exactly 32 characters long for AES-256',
      );
    }
    this.key = Buffer.from(rawKey, 'utf8');
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(12); // Standard GCM IV length is 12 bytes
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Output format: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error: any) {
      throw new InternalServerErrorException(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      throw new InternalServerErrorException(`Decryption failed: ${error.message}`);
    }
  }
}
