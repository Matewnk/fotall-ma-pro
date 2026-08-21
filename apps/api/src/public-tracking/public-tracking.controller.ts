import { Body, Controller, Post } from '@nestjs/common';
import { TrackOrderDto } from './dto/track-order.dto';
import { PublicTrackingService } from './public-tracking.service';

// Aucun guard : portail client public (§016-mobile-offline tranche 5),
// jamais de JWT côté client final. POST plutôt que GET : évite que le
// téléphone (donnée personnelle) transite en clair dans l'URL (logs
// d'accès, historique navigateur).
@Controller('suivi-commande')
export class PublicTrackingController {
  constructor(private readonly publicTrackingService: PublicTrackingService) {}

  @Post()
  suivre(@Body() dto: TrackOrderDto) {
    return this.publicTrackingService.suivre(dto);
  }
}
