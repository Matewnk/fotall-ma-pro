import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BusinessContactRequestsService } from './business-contact-requests.service';
import { CreateBusinessContactRequestDto } from './dto/create-business-contact-request.dto';

// Aucun guard : formulaire "Nous contacter" de la carte plan Business,
// accessible aussi bien a un visiteur anonyme qu'a un utilisateur tenant
// deja connecte (voir public-tracking.controller.ts pour le meme
// principe). Throttle dedie, plus strict que le defaut global
// (ThrottlerModule.forRoot, app.module.ts) mais pas au niveau anti brute-
// force d'un login : c'est un formulaire legitime qu'un meme visiteur peut
// soumettre plusieurs fois (devis puis question complementaire), pas une
// tentative d'authentification.
const LIMITE_SOUMISSIONS_CONTACT = { default: { limit: 20, ttl: 60_000 } };

@Controller('demandes-business')
export class BusinessContactRequestsController {
  constructor(private readonly businessContactRequestsService: BusinessContactRequestsService) {}

  @Throttle(LIMITE_SOUMISSIONS_CONTACT)
  @Post()
  create(@Body() dto: CreateBusinessContactRequestDto) {
    return this.businessContactRequestsService.create(dto);
  }
}
