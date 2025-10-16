import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, Platform, Share } from 'react-native';
import axios from 'axios';

import NavBar from './app/components/NavBar';
import { useChat } from './app/hooks/useChat';
import PvPScreen from './app/screens/PvP';
import ChatBubble from './app/components/ChatBubble';
import MessageInput from './app/components/MessageInput';
import { sanitizeVariant } from './app/lib/sanitize';
import { API } from './app/lib/config';
import styles from './app/styles';

export default function App() {
  const [screen, setScreen] = useState<'main'|'pve'|'pvp'>('main');

  return (
    <SafeAreaView style={styles.container}>
      <NavBar active={screen === 'main' ? 'Home' : screen === 'pve' ? 'PvE' : 'PvP'} onChange={(s) => setScreen(s === 'Home' ? 'main' : s === 'PvE' ? 'pve' : 'pvp')} />
      {screen === 'main' && <MainMenu onChoose={setScreen} />}
      {screen === 'pve' && <PvE />}
      {screen === 'pvp' && <PvPScreen />}
    </SafeAreaView>
  );
}


function MainMenu({ onChoose }: { onChoose: (s: any) => void }) {
  return (
    <View style={styles.mainMenu}>
      <Text style={styles.title}>LolaInParis</Text>
      <Text style={styles.subtitle}>Pick a mode</Text>
      <View style={{ marginTop: 16 }}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => onChoose('pve')}>
          <Text style={styles.menuText}>Talk to Lola</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuBtn} onPress={() => onChoose('pvp')}>
          <Text style={styles.menuText}>Talk to Friends</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PvE() {
  const { messages, loading, send, translate, setMessages } = useChat();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    axios.get(`${API}/history?limit=20`).then(r => setMessages(r.data.messages.reverse())).catch(()=>{});
  }, []);

  async function onSend() {
    if (!text) return;
    await send(text);
    setText('');
  }

  async function onTranslateFirst() {
    if (!text) return;
    setIsTranslating(true); setTranslateOptions([]);
    try {
      const res = await translate(text);
      const variants: string[] = res?.variants ?? [];
      if (Array.isArray(variants) && variants.length > 0) setTranslateOptions(variants.slice(0,3)); else setTranslateOptions([String(res?.variants || '(no variants)')]);
    } catch (e) { console.error('TranslateFirst failed', e); setTranslateOptions([`(translation failed) ${String(e)}`]); } finally { setIsTranslating(false); }
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Have a Convo with LolaInParis :D Pick a Mode and Start Chatting</Text>
        <View style={styles.modeRow}>
          {([
            { label: 'm1: LolaChat', value: 'm1' },
            { label: 'm2', value: 'm2' },
            { label: 'm3: LolaVoice', value: 'm3' }
          ] as const).map(mb => (
            <TouchableOpacity key={mb.label} onPress={() => setMode(mb.value)} style={[styles.modeBtn, mode===mb.value && styles.modeBtnActive]}>
              <Text style={styles.modeText}>{mb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList data={messages} keyExtractor={(i,idx)=>String(idx)} renderItem={({item}) => (<ChatBubble author={item.author} text={item.text} />)} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MessageInput value={text} onChange={setText} onSend={onSend} />
        <View style={{ marginLeft: 8 }}>
          <Button title={isTranslating ? 'Translating...' : 'Translate First'} onPress={onTranslateFirst} disabled={isTranslating} />
        </View>
      </View>
      {translateOptions.length>0 && (<View style={styles.translatePanel}><Text style={{ fontWeight: '600', marginBottom: 6 }}>Choose a translation</Text>{translateOptions.map(opt=> (<TouchableOpacity key={opt} onPress={() => { setText(sanitizeVariant(opt)); setTranslateOptions([]); }} style={styles.translateOption}><Text>{opt}</Text></TouchableOpacity>))}</View>)}
    </View>
  );
}


// styles are imported from ./app/styles
