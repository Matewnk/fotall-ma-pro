import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement } from '../lib/theme';
import { AuthenticatedStack } from './AuthenticatedStack';
import type { Role } from '../lib/types';

// Menu latéral — équivalent mobile de NAV_LINKS (apps/web/src/components/
// AppShell.tsx) : `roles` absent = visible à tous les rôles authentifiés.
// Un écran manquant de `roles` restreint ici n'est PAS pour autant
// autorisé côté serveur — le masquage n'est jamais une autorisation
// (§2.2 cahier des charges), chaque route sert son propre RBAC serveur.
// Complété au fur et à mesure que de nouveaux écrans sont construits
// (021, retour de test manuel : parité web/mobile).
const ELEMENTS_MENU: { route: string; libelle: string; roles?: Role[] }[] = [
  { route: 'TableauDeBord', libelle: 'Tableau de bord' },
  { route: 'NouvelleCommande', libelle: 'Nouvelle commande', roles: ['ADMIN', 'CAISSIER'] },
  {
    route: 'Suivi',
    libelle: 'Suivi des commandes',
    roles: ['ADMIN', 'TECHNICIEN', 'LIVREUR'],
  },
  { route: 'Clients', libelle: 'Clients', roles: ['ADMIN', 'CAISSIER'] },
  { route: 'Caisse', libelle: 'Journal de caisse', roles: ['ADMIN', 'CAISSIER'] },
  { route: 'Compte', libelle: 'Compte' },
];

function ContenuMenu({ navigation }: DrawerContentComponentProps) {
  const { session, logout } = useAuth();

  function allerVers(route: string) {
    navigation.dispatch(CommonActions.navigate({ name: 'Principal', params: { screen: route } }));
    navigation.closeDrawer();
  }

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <Text style={styles.nomPressing}>{session?.tenant.nomPressing}</Text>
        <Text style={styles.role}>{session?.user.role}</Text>
      </View>
      <View style={styles.liste}>
        {ELEMENTS_MENU.filter(
          (element) => !element.roles || (session && element.roles.includes(session.user.role)),
        ).map((element) => (
          <Pressable
            key={element.route}
            onPress={() => allerVers(element.route)}
            accessibilityRole="button"
            style={styles.lien}
          >
            <Text style={styles.lienTexte}>{element.libelle}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => logout()} accessibilityRole="button" style={styles.deconnexion}>
        <Text style={styles.deconnexionTexte}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const Drawer = createDrawerNavigator();

export function AppDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false }}
      drawerContent={(props) => <ContenuMenu {...props} />}
    >
      <Drawer.Screen name="Principal" component={AuthenticatedStack} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, paddingTop: 56, paddingHorizontal: espacement.margeMobile },
  entete: { marginBottom: 24, gap: 2 },
  nomPressing: { fontSize: 18, fontWeight: '700', color: couleurs.primary },
  role: {
    fontSize: 11,
    color: couleurs.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liste: { flex: 1, gap: 4 },
  lien: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  lienTexte: { fontSize: 15, color: couleurs.onSurface },
  deconnexion: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: couleurs.outlineVariant },
  deconnexionTexte: { color: couleurs.error, fontWeight: '600' },
});
