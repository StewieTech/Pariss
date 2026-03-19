import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
// import { SafeAreaView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import PvPScreen from './app/screens/PvP';
import PvEScreen from './app/screens/PvE';
import './global.css';
// then your normal imports

import NavBar from './app/components/NavBar';
import MainMenu from './app/components/MainMenu';
import { AuthProvider } from './app/lib/auth';
import AuthScreen from './app/screens/Auth';
import ProfileScreen from './app/screens/Profile';
import { DEFAULT_LANGUAGE, type AppLanguage } from './app/lib/languages';
import { createConversationId } from './app/lib/conversation';

type Screen = 'main' | 'pve' | 'pvp' | 'auth' | 'profile';
type PveMode = 'm1' | 'm3';

function getWebRouteState(): { screen: Screen; pveMode: PveMode } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { screen: 'main', pveMode: 'm1' };
  }

  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/chat') return { screen: 'pve', pveMode: 'm1' };
  if (path === '/voice') return { screen: 'pve', pveMode: 'm3' };
  if (path === '/friends') return { screen: 'pvp', pveMode: 'm1' };
  if (path === '/auth') return { screen: 'auth', pveMode: 'm1' };
  if (path === '/profile') return { screen: 'profile', pveMode: 'm1' };

  return { screen: 'main', pveMode: 'm1' };
}

function getPathForState(screen: Screen, pveMode: PveMode): string {
  if (screen === 'pve') return pveMode === 'm3' ? '/voice' : '/chat';
  if (screen === 'pvp') return '/friends';
  if (screen === 'auth') return '/auth';
  if (screen === 'profile') return '/profile';
  return '/';
}

export default function App() {
  const initialRoute = getWebRouteState();
  const [screen, setScreen] = useState<Screen>(initialRoute.screen);
  const [pveMode, setPveMode] = useState<PveMode>(initialRoute.pveMode);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [chatConversationId, setChatConversationId] = useState(() =>
    createConversationId('pve')
  );
  const [roomConversationId, setRoomConversationId] = useState(() =>
    createConversationId('pvp')
  );
  // useEffect(() => {
  //   try { console.log('App: screen changed ->', screen); } catch(e){}
  // }, [screen]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const next = getWebRouteState();
      setScreen(next.screen);
      setPveMode(next.pveMode);
    };

    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const nextPath = getPathForState(screen, pveMode);
    const currentPath = window.location.pathname || '/';

    if (currentPath !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, [screen, pveMode]);

  const handleNav = (nextScreen: Screen) => {
    setScreen(nextScreen);
    if (nextScreen !== 'pve') return;
    setPveMode('m1');
  };

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
  };

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-white">
          <NavBar current={screen} onNav={handleNav} />
          {screen === 'main' && <MainMenu onChoose={handleNav} />}
          {screen === 'auth' && <AuthScreen onDone={() => setScreen('main')} />}
          {screen === 'profile' && <ProfileScreen onDone={() => setScreen('main')} />}
          {screen === 'pve' && (
            <PvEScreen
              mode={pveMode}
              onModeChange={setPveMode}
              language={language}
              onLanguageChange={handleLanguageChange}
              conversationId={chatConversationId}
            />
          )}
          {screen === 'pvp' && (
            <PvPScreen
              language={language}
              onLanguageChange={handleLanguageChange}
              conversationId={roomConversationId}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </AuthProvider>
  ) 
}
