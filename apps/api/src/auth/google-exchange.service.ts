import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

const DUREE_MS = 60_000;

// Code d'echange a usage unique entre la redirection Google (callback,
// cote navigateur — jamais de JWT/token expose dans l'URL ou l'historique)
// et le POST /auth/google/exchange qui recupere reellement la session ou
// le ticket d'inscription. En memoire, mono-instance : aucun mecanisme de
// ce type n'existe deja dans le projet (Redis est dans la stack mais
// jamais cable a ce jour) — une extension multi-instance devra migrer ce
// store vers Redis, pas dupliquer un deuxieme mecanisme.
@Injectable()
export class GoogleExchangeService {
  private readonly codes = new Map<string, { expiresAt: number; payload: unknown }>();

  creer(payload: unknown): string {
    this.nettoyerExpires();
    const code = randomUUID();
    this.codes.set(code, { expiresAt: Date.now() + DUREE_MS, payload });
    return code;
  }

  // Usage unique : supprime toujours l'entree, meme si elle etait deja
  // expiree ou si le code est inconnu — jamais reutilisable.
  consommer<T>(code: string): T | null {
    const entry = this.codes.get(code);
    this.codes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.payload as T;
  }

  private nettoyerExpires() {
    const maintenant = Date.now();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt < maintenant) {
        this.codes.delete(code);
      }
    }
  }
}
