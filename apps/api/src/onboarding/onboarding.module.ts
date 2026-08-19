import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

// L'evenement onboarding.notification.test est consomme par
// NotificationsEventsListener (012), meme motif que LicenceModule.
@Module({
  imports: [ServicesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
