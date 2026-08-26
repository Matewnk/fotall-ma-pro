import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/lib/auth-context';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

// GestureHandlerRootView requis par react-native-gesture-handler (utilisé
// par @react-navigation/drawer, 021) : sans ce conteneur racine, le rendu
// échoue silencieusement sur web (page blanche, aucune erreur visible).
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
