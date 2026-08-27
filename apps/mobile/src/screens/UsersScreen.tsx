import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { CATALOGUE_PERMISSIONS } from '../lib/permissions';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { PermissionsUtilisateur, Role, Utilisateur } from '../lib/types';

const ROLES_GERABLES: Role[] = ['ADMIN', 'CAISSIER', 'TECHNICIEN', 'LIVREUR'];

const LIBELLES_ROLE: Record<Role, string> = {
  SUPER_ADMIN: 'Super-admin',
  ADMIN: 'Administrateur',
  CAISSIER: 'Caissier',
  TECHNICIEN: 'Technicien',
  LIVREUR: 'Livreur',
};

// Panneau de permissions par domaine — équivalent mobile de PermissionsPanel
// (apps/web/src/pages/UsersPage.tsx, 021, parité web/mobile 7/9). Une case
// non cochée annotée reflète le défaut du rôle (hérité) ; un override ADMIN
// affiche le badge "Personnalisé" + un bouton de réinitialisation. Chaque
// case sauvegarde immédiatement, pas de bouton "Enregistrer" distinct — pour
// ne jamais laisser un changement de droit non appliqué.
function PanneauPermissions({ userId, token }: { userId: string; token: string | undefined }) {
  const queryClient = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const permissions = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => apiFetch<PermissionsUtilisateur>(`/users/${userId}/permissions`, { token }),
  });

  const definir = useMutation({
    mutationFn: ({ permission, effet }: { permission: string; effet: 'ALLOW' | 'DENY' }) =>
      apiFetch(`/users/${userId}/permissions/${permission}`, {
        method: 'PUT',
        token,
        body: { effet },
      }),
    onSuccess: () => {
      setErreur(null);
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Modification impossible.');
    },
  });

  const reinitialiser = useMutation({
    mutationFn: (permission: string) =>
      apiFetch(`/users/${userId}/permissions/${permission}`, { method: 'DELETE', token }),
    onSuccess: () => {
      setErreur(null);
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Réinitialisation impossible.');
    },
  });

  if (permissions.isPending) {
    return <Text style={styles.videTexte}>Chargement des permissions…</Text>;
  }

  const overridesParPermission = new Map(
    permissions.data?.overrides.map((o) => [o.permission, o.effet]) ?? [],
  );

  return (
    <View style={styles.panneauPermissions}>
      {erreur && <Text style={styles.erreur}>{erreur}</Text>}
      {CATALOGUE_PERMISSIONS.map((domaine) => (
        <View key={domaine.domaine} style={{ gap: 4 }}>
          <Text style={styles.domainePermission}>{domaine.domaine}</Text>
          {domaine.permissions.map((permission) => {
            const accorde = permissions.data?.effectives.includes(permission.valeur) ?? false;
            const override = overridesParPermission.get(permission.valeur);
            return (
              <View key={permission.valeur} style={styles.lignePermission}>
                <Switch
                  value={accorde}
                  disabled={definir.isPending || reinitialiser.isPending}
                  onValueChange={() =>
                    definir.mutate({
                      permission: permission.valeur,
                      effet: accorde ? 'DENY' : 'ALLOW',
                    })
                  }
                />
                <Text style={styles.permissionLibelle}>{permission.libelle}</Text>
                {override && (
                  <View style={styles.badgePersonnalise}>
                    <Text style={styles.badgePersonnaliseTexte}>Personnalisé</Text>
                    <Pressable
                      onPress={() => reinitialiser.mutate(permission.valeur)}
                      accessibilityRole="button"
                      accessibilityLabel="Revenir au défaut du rôle"
                    >
                      <Text style={styles.lienReinitialiser}>↺</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Équivalent mobile de apps/web/src/pages/UsersPage.tsx (021, retour de
// test manuel : parité web/mobile). Mêmes contrats GET/POST/PATCH /users,
// PATCH /users/:id/mot-de-passe, GET/PUT/DELETE /users/:id/permissions.
// Réservé ADMIN (users.controller.ts). window.prompt n'existe pas en RN :
// la réinitialisation de mot de passe utilise un champ inline plutôt qu'une
// boîte de dialogue navigateur.
export function UsersScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const moiId = session?.user.id;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<Role>('CAISSIER');
  const [erreur, setErreur] = useState<string | null>(null);
  const [permissionsOuvertPour, setPermissionsOuvertPour] = useState<string | null>(null);
  const [reinitOuvertPour, setReinitOuvertPour] = useState<string | null>(null);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');

  const utilisateurs = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<Utilisateur[]>('/users', { token }),
  });

  const creerUtilisateur = useMutation({
    mutationFn: () =>
      apiFetch<Utilisateur>('/users', { method: 'POST', token, body: { email, motDePasse, role } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormulaireOuvert(false);
      setEmail('');
      setMotDePasse('');
      setRole('CAISSIER');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  const changerRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiFetch<Utilisateur>(`/users/${id}`, { method: 'PATCH', token, body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      apiFetch<Utilisateur>(`/users/${id}`, { method: 'PATCH', token, body: { actif } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const reinitialiserMotDePasse = useMutation({
    mutationFn: ({ id, motDePasse }: { id: string; motDePasse: string }) =>
      apiFetch<{ ok: true }>(`/users/${id}/mot-de-passe`, {
        method: 'PATCH',
        token,
        body: { motDePasse },
      }),
    onSuccess: () => {
      setReinitOuvertPour(null);
      setNouveauMotDePasse('');
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Réinitialisation impossible.');
    },
  });

  function confirmerDesactivation(utilisateur: Utilisateur) {
    Alert.alert(
      utilisateur.actif ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?',
      utilisateur.email,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: utilisateur.actif ? 'Désactiver' : 'Réactiver',
          style: utilisateur.actif ? 'destructive' : 'default',
          onPress: () => changerStatut.mutate({ id: utilisateur.id, actif: !utilisateur.actif }),
        },
      ],
    );
  }

  const actifs = utilisateurs.data?.filter((u) => u.actif).length ?? 0;

  return (
    <FlatList
      style={styles.conteneur}
      contentContainerStyle={styles.liste}
      data={utilisateurs.data ?? []}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={
        <View style={{ gap: espacement.base }}>
          <View style={styles.entete}>
            <View>
              <Text style={typographie.headlineLg}>Utilisateurs</Text>
              <Text style={styles.sousTitre}>{actifs} compte(s) actif(s)</Text>
            </View>
            <Pressable
              onPress={() => setFormulaireOuvert((ouvert) => !ouvert)}
              accessibilityRole="button"
              style={styles.boutonPrincipal}
            >
              <Text style={styles.boutonPrincipalTexte}>
                {formulaireOuvert ? 'Fermer' : 'Nouvel utilisateur'}
              </Text>
            </Pressable>
          </View>

          {formulaireOuvert && (
            <View style={styles.formulaire}>
              <TextInput
                style={styles.champ}
                placeholder="Email"
                accessibilityLabel="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.champ}
                placeholder="Mot de passe provisoire (8 caractères min.)"
                accessibilityLabel="Mot de passe provisoire"
                secureTextEntry
                value={motDePasse}
                onChangeText={setMotDePasse}
              />
              <View style={styles.selecteurRole}>
                {ROLES_GERABLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    style={[styles.puceRole, role === r && styles.puceRoleActive]}
                  >
                    <Text style={[styles.puceRoleTexte, role === r && styles.puceRoleTexteActive]}>
                      {LIBELLES_ROLE[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {erreur && <Text style={styles.erreur}>{erreur}</Text>}
              <Pressable
                onPress={() => creerUtilisateur.mutate()}
                disabled={creerUtilisateur.isPending || !email || !motDePasse}
                accessibilityRole="button"
                style={[
                  styles.boutonPrincipal,
                  (creerUtilisateur.isPending || !email || !motDePasse) && styles.boutonDesactive,
                ]}
              >
                <Text style={styles.boutonPrincipalTexte}>
                  {creerUtilisateur.isPending ? 'Création…' : "Créer l'utilisateur"}
                </Text>
              </Pressable>
            </View>
          )}

          {!formulaireOuvert && erreur && <Text style={styles.erreur}>{erreur}</Text>}
          {utilisateurs.isPending && <Text style={styles.videTexte}>Chargement…</Text>}
          {utilisateurs.data?.length === 0 && !utilisateurs.isPending && (
            <Text style={styles.videTexte}>Aucun utilisateur pour l'instant.</Text>
          )}
        </View>
      }
      renderItem={({ item: utilisateur }) => (
        <View style={{ gap: 6 }}>
          <View style={styles.carteUtilisateur}>
            <View style={styles.carteUtilisateurEntete}>
              <Text style={styles.utilisateurEmail}>{utilisateur.email}</Text>
              <View
                style={[
                  styles.badgeStatut,
                  { backgroundColor: utilisateur.actif ? '#6366f11a' : '#f59e0b1a' },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: utilisateur.actif ? couleurs.statutLivre : couleurs.statutEnAttente,
                  }}
                >
                  {utilisateur.actif ? 'ACTIF' : 'INACTIF'}
                </Text>
              </View>
            </View>

            {utilisateur.role === 'SUPER_ADMIN' ? (
              <View style={[styles.puceRole, styles.puceRoleActive, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.puceRoleTexte, styles.puceRoleTexteActive]}>
                  {LIBELLES_ROLE.SUPER_ADMIN}
                </Text>
              </View>
            ) : (
              <View style={styles.selecteurRole}>
                {ROLES_GERABLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => changerRole.mutate({ id: utilisateur.id, role: r })}
                    style={[styles.puceRole, utilisateur.role === r && styles.puceRoleActive]}
                  >
                    <Text
                      style={[
                        styles.puceRoleTexte,
                        utilisateur.role === r && styles.puceRoleTexteActive,
                      ]}
                    >
                      {LIBELLES_ROLE[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.ligneActions}>
              {utilisateur.role !== 'ADMIN' && utilisateur.role !== 'SUPER_ADMIN' && (
                <Pressable
                  onPress={() =>
                    setPermissionsOuvertPour((actuel) =>
                      actuel === utilisateur.id ? null : utilisateur.id,
                    )
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.lienAction}>Permissions</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  setReinitOuvertPour((actuel) =>
                    actuel === utilisateur.id ? null : utilisateur.id,
                  )
                }
                accessibilityRole="button"
              >
                <Text style={styles.lienAction}>Réinitialiser mot de passe</Text>
              </Pressable>
              {utilisateur.id !== moiId && (
                <Pressable
                  onPress={() => confirmerDesactivation(utilisateur)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.lienAction, utilisateur.actif && styles.lienActionDanger]}>
                    {utilisateur.actif ? 'Désactiver' : 'Réactiver'}
                  </Text>
                </Pressable>
              )}
            </View>

            {reinitOuvertPour === utilisateur.id && (
              <View style={styles.reinitBloc}>
                <TextInput
                  style={styles.champ}
                  placeholder="Nouveau mot de passe (8 caractères min.)"
                  accessibilityLabel="Nouveau mot de passe"
                  secureTextEntry
                  value={nouveauMotDePasse}
                  onChangeText={setNouveauMotDePasse}
                />
                <Pressable
                  onPress={() =>
                    reinitialiserMotDePasse.mutate({
                      id: utilisateur.id,
                      motDePasse: nouveauMotDePasse,
                    })
                  }
                  disabled={reinitialiserMotDePasse.isPending || nouveauMotDePasse.length < 8}
                  accessibilityRole="button"
                  style={[
                    styles.boutonSecondaire,
                    (reinitialiserMotDePasse.isPending || nouveauMotDePasse.length < 8) &&
                      styles.boutonDesactive,
                  ]}
                >
                  <Text style={styles.boutonSecondaireTexte}>
                    {reinitialiserMotDePasse.isPending ? 'Réinitialisation…' : 'Confirmer'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {permissionsOuvertPour === utilisateur.id && (
            <PanneauPermissions userId={utilisateur.id} token={token} />
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  liste: { padding: espacement.margeMobile, gap: 10, paddingBottom: 24 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sousTitre: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 2 },
  boutonPrincipal: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonPrincipalTexte: { color: couleurs.onPrimary, fontWeight: '600', fontSize: 13 },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  boutonSecondaireTexte: { color: couleurs.onSurface, fontWeight: '600', fontSize: 12 },
  formulaire: {
    gap: 8,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
  },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: couleurs.error, fontSize: 12 },
  selecteurRole: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puceRole: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  puceRoleActive: { backgroundColor: couleurs.primary, borderColor: couleurs.primary },
  puceRoleTexte: { fontSize: 11, color: couleurs.onSurface },
  puceRoleTexteActive: { color: couleurs.onPrimary, fontWeight: '600' },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
  carteUtilisateur: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 14,
    gap: 8,
  },
  carteUtilisateurEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utilisateurEmail: { fontWeight: '600', color: couleurs.onSurface, fontSize: 13 },
  badgeStatut: { borderRadius: rayon.full, paddingHorizontal: 8, paddingVertical: 3 },
  ligneActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  lienAction: { color: couleurs.primary, fontSize: 12, fontWeight: '600' },
  lienActionDanger: { color: couleurs.error },
  reinitBloc: { gap: 8, marginTop: 4 },
  panneauPermissions: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
    gap: 10,
  },
  domainePermission: {
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  lignePermission: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permissionLibelle: { flex: 1, fontSize: 13, color: couleurs.onSurface },
  badgePersonnalise: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgePersonnaliseTexte: {
    fontSize: 9,
    fontWeight: '700',
    color: couleurs.onSecondaryContainer,
    backgroundColor: couleurs.secondaryContainer,
    borderRadius: rayon.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lienReinitialiser: { fontSize: 14, color: couleurs.onSurfaceVariant },
});
