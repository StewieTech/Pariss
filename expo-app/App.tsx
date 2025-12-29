import { useState } from 'react';
// import { SafeAreaView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import PvPScreen from './app/screens/PvP';
import PvEScreen from './app/screens/PvE';
import './global.css';
// then your normal imports

import NavBar from './app/components/NavBar';
import MainMenu from './app/components/MainMenu';

export default function App() {
  const [screen, setScreen] = useState<'main'|'pve'|'pvp'>('main');
  // useEffect(() => {
  //   try { console.log('App: screen changed ->', screen); } catch(e){}
  // }, [screen]);


  return (
    <SafeAreaProvider>
    <SafeAreaView className="flex-1 bg-white">
      <NavBar current={screen} onNav={setScreen} />
      {screen === 'main' && <MainMenu onChoose={setScreen} />}
      {screen === 'pve' && <PvEScreen />}
      {screen === 'pvp' && <PvPScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  ) 
}
