import { Module } from '@nestjs/common';
import { FcmAdapter } from './adapters/fcm.adapter';
import { NOTIFICATION_ADAPTERS } from './adapters/notification-adapters.token';
import { SmsAdapter } from './adapters/sms.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { NotificationsEventsListener } from './notifications-events.listener';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    FcmAdapter,
    WhatsAppAdapter,
    SmsAdapter,
    {
      provide: NOTIFICATION_ADAPTERS,
      useFactory: (fcm: FcmAdapter, whatsapp: WhatsAppAdapter, sms: SmsAdapter) => [
        fcm,
        whatsapp,
        sms,
      ],
      inject: [FcmAdapter, WhatsAppAdapter, SmsAdapter],
    },
    NotificationsService,
    NotificationsEventsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
