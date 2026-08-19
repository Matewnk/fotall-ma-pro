import { Prisma, TypeOperationCaisse } from '../generated/tenant-client';

// Signe applique au solde selon le type d'operation. OUVERTURE/ENCAISSEMENT/
// AVANCE augmentent le solde ; DEPENSE/REMBOURSEMENT le diminuent ;
// AJUSTEMENT_COMPENSATOIRE porte son propre signe (correction, positive ou
// negative) ; CLOTURE est un marqueur qui n'affecte jamais le solde.
export function effetSurSolde(type: TypeOperationCaisse, montant: Prisma.Decimal): Prisma.Decimal {
  switch (type) {
    case TypeOperationCaisse.OUVERTURE:
    case TypeOperationCaisse.ENCAISSEMENT:
    case TypeOperationCaisse.AVANCE:
      return montant;
    case TypeOperationCaisse.DEPENSE:
    case TypeOperationCaisse.REMBOURSEMENT:
      return montant.negated();
    case TypeOperationCaisse.AJUSTEMENT_COMPENSATOIRE:
      return montant;
    case TypeOperationCaisse.CLOTURE:
      return new Prisma.Decimal(0);
  }
}

// Types dont le montant saisi doit toujours être positif (le signe de
// l'effet est déterminé par le type, pas par l'appelant).
export const TYPES_MONTANT_POSITIF: TypeOperationCaisse[] = [
  TypeOperationCaisse.OUVERTURE,
  TypeOperationCaisse.ENCAISSEMENT,
  TypeOperationCaisse.AVANCE,
  TypeOperationCaisse.DEPENSE,
  TypeOperationCaisse.REMBOURSEMENT,
];
