import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { AccountScreen } from '../screens/AccountScreen';
import { LoginScreen } from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();

// Redirection côté client uniquement (confort UX) — jamais une garantie
// de sécurité : chaque écran authentifié appelle une API qui revalide le
// JWT et le rôle indépendamment (RBAC serveur). Équivalent mobile de
// ProtectedRoute (apps/web/src/components/ProtectedRoute.tsx), adapté au
// modèle de navigation par pile de React Navigation plutôt que par route
// URL.
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Compte" component={AccountScreen} />
        ) : (
          <Stack.Screen name="Connexion" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
