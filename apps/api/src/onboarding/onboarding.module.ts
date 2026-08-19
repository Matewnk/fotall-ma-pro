import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingEventsListener } from './onboarding-events.listener';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [ServicesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingEventsListener],
  exports: [OnboardingService],
})
export class OnboardingModule {}
