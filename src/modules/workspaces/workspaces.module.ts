import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { EmailModule } from '@infrastructure/email/email.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

// Import Use Cases
import { CreateWorkspaceUseCase } from './use-cases/create-workspace.use-case';
import { VerifyOnboardingOtpUseCase } from './use-cases/verify-onboarding-otp.use-case';
import { LoginRequestUseCase } from './use-cases/login-request.use-case';
import { LoginVerifyUseCase } from './use-cases/login-verify.use-case';
import { GenerateApiKeyUseCase } from './use-cases/generate-api-key.use-case';
import { GetApiKeysUseCase } from './use-cases/get-api-keys.use-case';
import { DeleteApiKeyUseCase } from './use-cases/delete-api-key.use-case';
import { RegisterCredentialsUseCase } from './use-cases/register-credentials.use-case';
import { GetWorkspaceAnalyticsUseCase } from './use-cases/get-workspace-analytics.use-case';
import { GetWorkspaceAuditLogsUseCase } from './use-cases/get-workspace-audit-logs.use-case';
import { SimulateWebhookUseCase } from './use-cases/simulate-webhook.use-case';
import { GetWorkspaceQuarantineUseCase } from './use-cases/get-workspace-quarantine.use-case';
import { ReleaseQuarantinedFundsUseCase } from './use-cases/release-quarantined-funds.use-case';
import { RejectQuarantinedFundsUseCase } from './use-cases/reject-quarantined-funds.use-case';

@Module({
  imports: [EmailModule, WebhooksModule],
  controllers: [WorkspacesController],
  providers: [
    CreateWorkspaceUseCase,
    VerifyOnboardingOtpUseCase,
    LoginRequestUseCase,
    LoginVerifyUseCase,
    GenerateApiKeyUseCase,
    GetApiKeysUseCase,
    DeleteApiKeyUseCase,
    RegisterCredentialsUseCase,
    GetWorkspaceAnalyticsUseCase,
    GetWorkspaceAuditLogsUseCase,
    SimulateWebhookUseCase,
    GetWorkspaceQuarantineUseCase,
    ReleaseQuarantinedFundsUseCase,
    RejectQuarantinedFundsUseCase,
  ],
  exports: [
    CreateWorkspaceUseCase,
    VerifyOnboardingOtpUseCase,
    LoginRequestUseCase,
    LoginVerifyUseCase,
    GenerateApiKeyUseCase,
    GetApiKeysUseCase,
    DeleteApiKeyUseCase,
    RegisterCredentialsUseCase,
    GetWorkspaceAnalyticsUseCase,
    GetWorkspaceAuditLogsUseCase,
    SimulateWebhookUseCase,
    GetWorkspaceQuarantineUseCase,
    ReleaseQuarantinedFundsUseCase,
    RejectQuarantinedFundsUseCase,
  ],
})
export class WorkspacesModule {}
