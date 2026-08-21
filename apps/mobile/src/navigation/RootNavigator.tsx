import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { AccountScreen } from '../screens/AccountScreen';
import { CustomerTrackingScreen } from '../screens/CustomerTrackingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NewOrderScreen } from '../screens/NewOrderScreen';
import { OrdersStatusScreen } from '../screens/OrdersStatusScreen';

const Stack = createNativeStackNavigator();

function BoutonCompte({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>Compte</Text>
    </Pressable>
  );
}

function routeInitiale(role: string | undefined): 'NouvelleCommande' | 'Suivi' | 'Compte' {
  if (role === 'CAISSIER') return 'NouvelleCommande';
  if (role === 'TECHNICIEN' || role === 'LIVREUR') return 'Suivi';
  return 'Compte';
}

// Redirection côté client uniquement (confort UX) — jamais une garantie
// de sécurité : chaque écran authentifié appelle une API qui revalide le
// JWT et le rôle indépendamment (RBAC serveur). Équivalent mobile de
// ProtectedRoute (apps/web/src/components/ProtectedRoute.tsx), adapté au
// modèle de navigation par pile de React Navigation plutôt que par route
// URL. Atterrissage par rôle : CAISSIER → nouvelle commande (009),
// TECHNICIEN/LIVREUR → suivi des commandes (009), ADMIN → Compte —
// affichage seulement, jamais une autorisation.
export function RootNavigator() {
  const { session, chargement } = useAuth();

  if (chargement) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={routeInitiale(session?.user.role)}>
        {session ? (
          <>
            <Stack.Screen
              name="NouvelleCommande"
              component={NewOrderScreen}
              options={({ navigation }) => ({
                title: 'Nouvelle commande',
                headerRight: () => <BoutonCompte onPress={() => navigation.navigate('Compte')} />,
              })}
            />
            <Stack.Screen
              name="Suivi"
              component={OrdersStatusScreen}
              options={({ navigation }) => ({
                title: 'Suivi des commandes',
                headerRight: () => <BoutonCompte onPress={() => navigation.navigate('Compte')} />,
              })}
            />
            <Stack.Screen name="Compte" component={AccountScreen} options={{ title: 'Compte' }} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Connexion"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SuiviClient"
              component={CustomerTrackingScreen}
              options={{ title: 'Suivre ma commande' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
