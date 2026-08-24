import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, apiFetchBlob } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { declencherTelechargement, ouvrirBlobDansNouvelOnglet } from '../lib/download';
import type { Commande } from '../lib/types';

// Écran §011 (tickets/impression) — maquette de référence :
// docs/design/screens/gestion_de_l_impression_thermique. La maquette
// suppose un parc d'imprimantes réseau surveillé (état, file de jobs) :
// aucun backend de ce type n'existe (pas de gestion de matériel
// d'impression). Adapté à ce qui existe réellement (011-tickets-printing) :
// générer/télécharger le ticket PDF ou ESC/POS d'une commande existante.
export function TicketsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const commandes = useQuery({
    queryKey: ['commandes'],
    queryFn: () => apiFetch<Commande[]>('/commandes', { token }),
  });

  async function voirPdf(commande: Commande) {
    setErreur(null);
    setEnCours(`${commande.id}-pdf`);
    try {
      const blob = await apiFetchBlob(`/commandes/${commande.id}/ticket/pdf`, { token });
      ouvrirBlobDansNouvelOnglet(blob);
    } catch {
      setErreur(`Impossible de générer le ticket PDF de la commande #${commande.numero}.`);
    } finally {
      setEnCours(null);
    }
  }

  async function voirBonLivraison(commande: Commande) {
    setErreur(null);
    setEnCours(`${commande.id}-bon-livraison`);
    try {
      const blob = await apiFetchBlob(`/commandes/${commande.id}/ticket/bon-livraison/pdf`, {
        token,
      });
      ouvrirBlobDansNouvelOnglet(blob);
    } catch {
      setErreur(`Impossible de générer le bon de livraison de la commande #${commande.numero}.`);
    } finally {
      setEnCours(null);
    }
  }

  async function telechargerEscPos(commande: Commande, largeur: 58 | 80) {
    setErreur(null);
    setEnCours(`${commande.id}-escpos-${largeur}`);
    try {
      const blob = await apiFetchBlob(
        `/commandes/${commande.id}/ticket/escpos?largeur=${largeur}`,
        { token },
      );
      declencherTelechargement(blob, `ticket-${commande.numero}-${largeur}mm.bin`);
    } catch {
      setErreur(`Impossible de générer le ticket ESC/POS de la commande #${commande.numero}.`);
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Tickets</h1>
        <p className="text-sm text-on-surface-variant">
          Réimprimer ou télécharger le ticket d'une commande (PDF avec QR code, ou ESC/POS 58mm/80mm
          pour imprimante thermique).
        </p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Numéro</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {commandes.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={3}>
                  Chargement…
                </td>
              </tr>
            )}
            {commandes.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={3}>
                  Aucune commande pour l'instant.
                </td>
              </tr>
            )}
            {commandes.data?.map((commande) => (
              <tr key={commande.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-mono">#{commande.numero}</td>
                <td className="px-4 py-2">{commande.total} FCFA</td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={enCours === `${commande.id}-pdf`}
                      onClick={() => voirPdf(commande)}
                      className="text-primary text-xs font-medium disabled:opacity-60"
                    >
                      Ticket PDF
                    </button>
                    <button
                      type="button"
                      disabled={enCours === `${commande.id}-escpos-58`}
                      onClick={() => telechargerEscPos(commande, 58)}
                      className="text-primary text-xs font-medium disabled:opacity-60"
                    >
                      ESC/POS 58mm
                    </button>
                    <button
                      type="button"
                      disabled={enCours === `${commande.id}-escpos-80`}
                      onClick={() => telechargerEscPos(commande, 80)}
                      className="text-primary text-xs font-medium disabled:opacity-60"
                    >
                      ESC/POS 80mm
                    </button>
                    {commande.modeLivraison === 'LIVRAISON' && (
                      <button
                        type="button"
                        disabled={enCours === `${commande.id}-bon-livraison`}
                        onClick={() => voirBonLivraison(commande)}
                        className="text-primary text-xs font-medium disabled:opacity-60"
                      >
                        Bon de livraison
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
