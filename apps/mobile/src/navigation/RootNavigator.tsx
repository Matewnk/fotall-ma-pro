import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { CustomerTrackingScreen } from '../screens/CustomerTrackingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { AppDrawer } from './AppDrawer';

const Stack = createNativeStackNavigator();

// Racine de navigation : non authentifié -> pile Connexion/SuiviClient
// (inchangé) ; authentifié -> menu latéral (AppDrawer.tsx, 021) plutôt
// qu'une simple pile — nécessaire pour la parité web/mobile (retour de
// test manuel) une fois le nombre d'écrans accessibles au-delà de
// Commandes/Suivi/Compte.
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
      {session ? (
        <AppDrawer />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Connexion" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="SuiviClient"
            component={CustomerTrackingScreen}
            options={{ title: 'Suivre ma commande' }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
