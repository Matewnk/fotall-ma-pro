import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';
import type { TicketData } from '../lib/types';

const LIBELLES_STATUT: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  PRET: 'Terminé',
  LIVRE: 'Livré',
};

const TAILLE_QR = 132;

// Rendu QR pur JS (qrcode-generator, sans dépendance native) : une grille
// de View carrés reproduisant la matrice de modules, même donnée que le
// PDF web (pdf.builder.ts : `FOTALL-MA:COMMANDE:${numero}`).
function CodeQr({ valeur }: { valeur: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(valeur);
  qr.make();
  const nombreModules = qr.getModuleCount();
  const tailleModule = TAILLE_QR / nombreModules;

  return (
    <View style={{ width: TAILLE_QR, height: TAILLE_QR, backgroundColor: '#ffffff' }}>
      {Array.from({ length: nombreModules }).map((_, ligne) =>
        Array.from({ length: nombreModules }).map((_, colonne) =>
          qr.isDark(ligne, colonne) ? (
            <View
              key={`${ligne}-${colonne}`}
              style={{
                position: 'absolute',
                left: colonne * tailleModule,
                top: ligne * tailleModule,
                width: tailleModule,
                height: tailleModule,
                backgroundColor: '#000000',
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}

function LigneDeuxColonnes({
  gauche,
  droite,
  gras,
  taille,
}: {
  gauche: string;
  droite: string;
  gras?: boolean;
  taille?: number;
}) {
  return (
    <View style={styles.ligneListe}>
      <Text style={[styles.texteBase, gras && styles.gras, taille ? { fontSize: taille } : null]}>
        {gauche}
      </Text>
      <Text style={[styles.texteBase, gras && styles.gras, taille ? { fontSize: taille } : null]}>
        {droite}
      </Text>
    </View>
  );
}

// Ticket de caisse affiché juste après un encaissement réussi (mobile),
// calqué fidèlement sur le PDF thermique 80mm du web (pdf.builder.ts) :
// mêmes libellés, même ordre des sections, même QR (FOTALL-MA:COMMANDE:n).
// Équivalent de l'ouverture automatique du PDF sur web
// (OrderCheckoutPage.tsx : apiFetchBlob('/commandes/:id/ticket/pdf') dans
// un nouvel onglet) — affichage natif ici, pas de lecteur PDF sur mobile.
export function TicketScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commandeId } = route.params as { commandeId: string };
  const { session } = useAuth();
  const token = session?.accessToken;

  const donnees = useQuery({
    queryKey: ['ticket-data', commandeId],
    queryFn: () => apiFetch<TicketData>(`/commandes/${commandeId}/ticket/data`, { token }),
  });

  if (donnees.isPending) {
    return (
      <View style={styles.conteneur}>
        <ActivityIndicator />
      </View>
    );
  }
  if (donnees.isError || !donnees.data) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.erreur}>Ticket introuvable.</Text>
      </View>
    );
  }

  const data = donnees.data;
  const remiseAffichee = data.remise !== '0' && data.remise !== '0.00';

  function nouvelleCommande() {
    // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir AuthenticatedStack.tsx
    navigation.navigate('NouvelleCommande');
  }

  return (
    <ScrollView
      style={styles.conteneur}
      contentContainerStyle={{ gap: espacement.gutter, padding: espacement.margeMobile }}
    >
      <View style={styles.feuille}>
        {data.estProvisoire && <Text style={styles.provisoire}>** NUMÉRO PROVISOIRE **</Text>}

        <View style={styles.entete}>
          <Text style={styles.nomPressing}>{data.nomPressing}</Text>
          {data.adresseTenant && <Text style={styles.sousTexte}>{data.adresseTenant}</Text>}
          {data.telephoneTenant && <Text style={styles.sousTexte}>{data.telephoneTenant}</Text>}
        </View>

        <View style={styles.separateur} />

        <Text style={styles.commandeNumero}>
          Commande #{data.numero}
          {data.estProvisoire ? ' (provisoire)' : ''}
        </Text>
        <Text style={styles.texteBase}>
          Client : {data.client.nom} — {data.client.telephone}
        </Text>
        <LigneDeuxColonnes
          gauche="Statut :"
          droite={LIBELLES_STATUT[data.statut] ?? data.statut}
          gras
        />

        <View style={styles.separateur} />

        {data.articles.map((article, index) => (
          <LigneDeuxColonnes
            key={index}
            gauche={`${article.quantite} x ${article.intitule}`}
            droite={article.sousTotal}
          />
        ))}

        <View style={styles.separateur} />

        <LigneDeuxColonnes gauche="Sous-total :" droite={data.sousTotal} />
        {remiseAffichee && <LigneDeuxColonnes gauche="Remise :" droite={`-${data.remise}`} />}
        <LigneDeuxColonnes gauche="TOTAL :" droite={`${data.total} FCFA`} gras taille={16} />

        <Text style={styles.mode}>Mode : {data.modeLivraison}</Text>
        {data.adresseLivraison && (
          <Text style={styles.centre}>Livraison : {data.adresseLivraison}</Text>
        )}
        {data.datePrevue && (
          <Text style={styles.centre}>Prévu le : {data.datePrevue.slice(0, 10)}</Text>
        )}

        <View style={styles.zoneQr}>
          <CodeQr valeur={`FOTALL-MA:COMMANDE:${data.numero}`} />
        </View>

        <Text style={styles.merci}>Merci de votre confiance !</Text>
        <Text style={styles.pied}>Fotall-Ma PRO</Text>
      </View>

      <Pressable onPress={nouvelleCommande} accessibilityRole="button" style={styles.bouton}>
        <Text style={styles.boutonTexte}>Nouvelle commande</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  feuille: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 16,
    gap: 4,
  },
  provisoire: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    color: couleurs.onSurface,
    marginBottom: 4,
  },
  entete: { alignItems: 'center', gap: 1 },
  nomPressing: { fontSize: 17, fontWeight: '700', color: couleurs.onSurface },
  sousTexte: { color: couleurs.onSurfaceVariant, fontSize: 11, textAlign: 'center' },
  separateur: {
    borderTopWidth: 1,
    borderTopColor: couleurs.outline,
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  commandeNumero: { fontWeight: '700', fontSize: 13, color: couleurs.onSurface, marginBottom: 2 },
  texteBase: { fontSize: 12, color: couleurs.onSurface },
  gras: { fontWeight: '700' },
  ligneListe: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  mode: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    color: couleurs.onSurface,
    marginTop: 6,
  },
  centre: { textAlign: 'center', fontSize: 12, color: couleurs.onSurface },
  zoneQr: { alignItems: 'center', marginTop: 10, marginBottom: 4 },
  merci: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    color: couleurs.onSurface,
    marginTop: 4,
  },
  pied: { textAlign: 'center', fontSize: 11, color: couleurs.onSurfaceVariant },
  erreur: { color: couleurs.error, fontSize: 13, textAlign: 'center', marginTop: 24 },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
});
