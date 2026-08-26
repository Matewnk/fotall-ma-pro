import { DrawerActions, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { couleurs } from '../lib/theme';
import { AccountScreen } from '../screens/AccountScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DeliverySlipScreen } from '../screens/DeliverySlipScreen';
import { NewOrderScreen } from '../screens/NewOrderScreen';
import { OrderCheckoutScreen } from '../screens/OrderCheckoutScreen';
import { OrdersStatusScreen } from '../screens/OrdersStatusScreen';

const Stack = createNativeStackNavigator();

// Ouvre le menu latéral (AppDrawer.tsx) : équivalent mobile de la sidebar
// web (AppShell.tsx), remplace le bouton "Compte" isolé d'origine
// maintenant qu'il existe un menu complet listant tous les écrans
// accessibles au rôle courant.
function BoutonMenu() {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le menu"
    >
      <Text style={{ color: couleurs.primary, fontWeight: '600' }}>Menu</Text>
    </Pressable>
  );
}

function routeInitiale(role: string | undefined): 'NouvelleCommande' | 'Suivi' | 'TableauDeBord' {
  if (role === 'CAISSIER') return 'NouvelleCommande';
  if (role === 'TECHNICIEN' || role === 'LIVREUR') return 'Suivi';
  return 'TableauDeBord';
}

// Pile des écrans authentifiés (021, retour de test manuel : parité web/
// mobile) — désormais rendue à l'intérieur d'un Drawer.Navigator
// (AppDrawer.tsx) plutôt qu'à la racine : le menu latéral liste les
// destinations, cette pile gère les flux internes (ex. NouvelleCommande
// → Encaissement, Suivi → BonLivraison) exactement comme avant.
export function AuthenticatedStack() {
  const { session } = useAuth();

  return (
    <Stack.Navigator initialRouteName={routeInitiale(session?.user.role)}>
      <Stack.Screen
        name="TableauDeBord"
        component={DashboardScreen}
        options={{ title: 'Tableau de bord', headerRight: () => <BoutonMenu /> }}
      />
      <Stack.Screen
        name="NouvelleCommande"
        component={NewOrderScreen}
        options={{ title: 'Nouvelle commande', headerRight: () => <BoutonMenu /> }}
      />
      <Stack.Screen
        name="Suivi"
        component={OrdersStatusScreen}
        options={{ title: 'Suivi des commandes', headerRight: () => <BoutonMenu /> }}
      />
      <Stack.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ title: 'Clients', headerRight: () => <BoutonMenu /> }}
      />
      <Stack.Screen name="Compte" component={AccountScreen} options={{ title: 'Compte' }} />
      <Stack.Screen
        name="BonLivraison"
        component={DeliverySlipScreen}
        options={{ title: 'Bon de livraison' }}
      />
      <Stack.Screen
        name="Encaissement"
        component={OrderCheckoutScreen}
        options={{ title: 'Encaissement' }}
      />
    </Stack.Navigator>
  );
}
