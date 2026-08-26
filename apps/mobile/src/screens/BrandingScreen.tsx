import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { TenantSettings } from '../lib/types';

type Formulaire = {
  nomPressing: string;
  adresse: string;
  telephone: string;
  langue: string;
  devise: string;
  fuseauHoraire: string;
};

function versFormulaire(tenant: TenantSettings): Formulaire {
  return {
    nomPressing: tenant.nomPressing,
    adresse: tenant.adresse ?? '',
    telephone: tenant.telephone ?? '',
    langue: tenant.langue,
    devise: tenant.devise,
    fuseauHoraire: tenant.fuseauHoraire,
  };
}

// Équivalent mobile de apps/web/src/pages/BrandingPage.tsx (021, retour de
// test manuel : parité web/mobile), réservé ADMIN (tenant-settings.controller.ts).
// Même contrat GET/PATCH /tenant. Simplification volontaire "saisie rapide
// terrain" : l'envoi du logo (POST /tenant/logo, multipart) exigerait une
// dépendance de sélection d'image (expo-image-picker, absente du projet) —
// omis ici, consultation en lecture seule du logo actuel si présent.
export function BrandingScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const tenant = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/tenant', { token }),
  });

  useEffect(() => {
    if (tenant.data && !formulaire) {
      setFormulaire(versFormulaire(tenant.data));
    }
  }, [tenant.data, formulaire]);

  const enregistrer = useMutation({
    mutationFn: () => {
      if (!formulaire) throw new Error('formulaire non initialisé');
      return apiFetch<TenantSettings>('/tenant', {
        method: 'PATCH',
        token,
        body: {
          nomPressing: formulaire.nomPressing,
          langue: formulaire.langue,
          devise: formulaire.devise,
          fuseauHoraire: formulaire.fuseauHoraire,
          ...(formulaire.adresse ? { adresse: formulaire.adresse } : {}),
          ...(formulaire.telephone ? { telephone: formulaire.telephone } : {}),
        },
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tenant-settings'], data);
      setSucces(true);
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
      setSucces(false);
    },
  });

  if (!formulaire) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.videTexte}>Chargement…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={styles.contenu}>
      <View>
        <Text style={typographie.headlineLg}>Branding</Text>
        <Text style={styles.sousTitre}>
          Ces informations apparaissent sur les tickets et communications clients.
        </Text>
      </View>

      <View style={styles.formulaire}>
        <View style={styles.pastilleLogoLigne}>
          <View style={styles.pastilleLogo}>
            {tenant.data?.logoUrl ? (
              <Text style={styles.pastilleLogoTexte}>LOGO</Text>
            ) : (
              <Text style={styles.pastilleLogoTexte}>—</Text>
            )}
          </View>
          <Text style={styles.pastilleLogoInfo}>
            {tenant.data?.logoUrl
              ? 'Logo actuel (modifiable depuis le web).'
              : "Aucun logo — à ajouter depuis l'écran web Branding."}
          </Text>
        </View>

        <TextInput
          style={styles.champ}
          placeholder="Nom de l'établissement"
          accessibilityLabel="Nom de l'établissement"
          value={formulaire.nomPressing}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, nomPressing: v })}
        />
        <TextInput
          style={styles.champ}
          placeholder="Adresse"
          accessibilityLabel="Adresse"
          value={formulaire.adresse}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, adresse: v })}
        />
        <TextInput
          style={styles.champ}
          placeholder="Téléphone"
          accessibilityLabel="Téléphone"
          keyboardType="phone-pad"
          value={formulaire.telephone}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, telephone: v })}
        />
        <TextInput
          style={styles.champ}
          placeholder="Langue"
          accessibilityLabel="Langue"
          value={formulaire.langue}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, langue: v })}
        />
        <TextInput
          style={styles.champ}
          placeholder="Devise"
          accessibilityLabel="Devise"
          value={formulaire.devise}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, devise: v })}
        />
        <TextInput
          style={styles.champ}
          placeholder="Fuseau horaire"
          accessibilityLabel="Fuseau horaire"
          value={formulaire.fuseauHoraire}
          onChangeText={(v) => setFormulaire((f) => f && { ...f, fuseauHoraire: v })}
        />

        {erreur && <Text style={styles.erreur}>{erreur}</Text>}
        {succes && <Text style={styles.succes}>Enregistré.</Text>}

        <Pressable
          onPress={() => {
            setErreur(null);
            setSucces(false);
            enregistrer.mutate();
          }}
          disabled={enregistrer.isPending}
          accessibilityRole="button"
          style={[styles.boutonPrincipal, enregistrer.isPending && styles.boutonDesactive]}
        >
          <Text style={styles.boutonPrincipalTexte}>
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  contenu: { padding: espacement.margeMobile, gap: espacement.base, paddingBottom: 24 },
  sousTitre: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 4 },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 24 },
  formulaire: {
    gap: 10,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 14,
  },
  pastilleLogoLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastilleLogo: {
    width: 56,
    height: 56,
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    backgroundColor: couleurs.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleLogoTexte: { fontSize: 10, fontWeight: '700', color: couleurs.onSurfaceVariant },
  pastilleLogoInfo: { flex: 1, fontSize: 12, color: couleurs.onSurfaceVariant },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: couleurs.error, fontSize: 12 },
  succes: { color: couleurs.statutTermine, fontSize: 12 },
  boutonPrincipal: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  boutonDesactive: { opacity: 0.6 },
  boutonPrincipalTexte: { color: couleurs.onPrimary, fontWeight: '600', fontSize: 13 },
});
