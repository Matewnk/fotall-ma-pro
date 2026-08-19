import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingEventsListener } from './onboarding-events.listener';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingEventsListener],
  exports: [OnboardingService],
})
export class OnboardingModule {}
