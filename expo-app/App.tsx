import  { useEffect, useState, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { speakText } from './app/services/voice';
import PvPScreen from './app/screens/PvP';
import client from './app/lib/client';
import './global.css';
import SendButton from './app/components/SendButton';
import { API }  from './app/lib/config';
// then your normal imports


import { sanitizeVariant, parseRoomIdFromRaw } from './app/lib/utils';
import NavBar from './app/components/NavBar';
import MainMenu from './app/components/MainMenu';
// Deployed function URL (used when not running locally)
// const DEFAULT_DEPLOYED = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';
// const DEFAULT_LOCAL = 'http://192.168.2.44:4000'; // local dev server

// // Resolve API base simply: allow global override, otherwise detect runtime and pick local for local dev or deployed otherwise.
// const explicit = (globalThis as any)?.EXPO_API_URL;
// const isBrowserLocal = typeof globalThis !== 'undefined' && (globalThis as any).location && ['localhost', '127.0.0.1'].includes((globalThis as any).location.hostname) || ((globalThis as any).location && (globalThis as any).location.hostname?.startsWith('192.168.'));
// const API_BASE = explicit || (isBrowserLocal ? DEFAULT_LOCAL : DEFAULT_DEPLOYED);
// const API = `${API_BASE}`;
// // log the computed API for debugging in the browser console
// if (typeof console !== 'undefined') console.log('Lola Demo API base:', API_BASE);

// sanitizeVariant moved to app/lib/utils.ts and imported above

export default function App() {
  const [screen, setScreen] = useState<'main'|'pve'|'pvp'>('main');
  // useEffect(() => {
  //   try { console.log('App: screen changed ->', screen); } catch(e){}
  // }, [screen]);


  return (
    <SafeAreaView style={styles.container}>
      <NavBar current={screen} onNav={setScreen} />
      {screen === 'main' && <MainMenu onChoose={setScreen} />}
      {screen === 'pve' && <PvE />}
      {screen === 'pvp' && <PvPScreen />}
      </SafeAreaView>
  ) 
}




// NavBar and MainMenu extracted to app/components for testability

function PvE() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
  const sendRef = useRef<{ send?: () => void } | null>(null);
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // web-specific keyboard handler props (onKeyDown isn't part of RN TextInputProps types)
  const webKeyDownProps: any = Platform.OS === 'web' ? {
    onKeyDown: (e: any) => {
      const key = e?.key ?? e?.nativeEvent?.key;
      const shift = e?.shiftKey ?? e?.nativeEvent?.shiftKey;
      const alt = e?.altKey ?? e?.nativeEvent?.altKey;
      const ctrl = e?.ctrlKey ?? e?.nativeEvent?.ctrlKey;
      const meta = e?.metaKey ?? e?.nativeEvent?.metaKey;
      if (key === 'Enter') {
        // only treat Enter as send when no modifier keys are pressed
        if (shift || alt || ctrl || meta) {
          // allow newline when any modifier is used
          return;
        }
        if (e.preventDefault) e.preventDefault();
        sendRef.current?.send && sendRef.current.send();
      }
    }
  } : {};

  // ...existing chat logic moved here...
  // useEffect(() => {
  //   Axios.get(`${API}/history?limit=20`).then((r: any) => setMessages(r.data.messages.reverse())).catch(()=>{});
  // }, []);

  // using shared sanitizeVariant from app/lib/utils

  // async function send() {
  //   if (!text) return;
  //   const userMsg = { role: 'user', content: text };
  //   setMessages(prev => [...prev, userMsg]);
  //   setText('');
  //   try {
  //     const res = await client.post(`${API}/chat/send`, { text: userMsg.content, mode });
  //     setMessages(prev => [...prev, { role: 'assistant', content: res.data?.reply ?? '' }]);
  //   } catch (err: any) {
  //     console.error('API call failed', err);
  //     let message = 'Error calling API';
  //     try { if (err?.response) message = `API error ${err.response.status}: ${err.response.data?.error ?? JSON.stringify(err.response.data)}`; else if (err.request) message = 'No response from server (network or CORS)'; else message = String(err?.message || err); } catch(e){message=String(e);}      
  //     setMessages(prev => [...prev, { role: 'assistant', content: message }]);
  //   }
  // }

  async function translateFirst() {
    if (!text) return;
    setIsTranslating(true); setTranslateOptions([]);
    try {
      const res = await client.post(`${API}/chat/translate`, { text });
      const variants: string[] = res?.data?.variants ?? [];
      if (Array.isArray(variants) && variants.length > 0) setTranslateOptions(variants.slice(0,3)); else setTranslateOptions([String(res?.data?.variants || '(no variants)')]);
    } catch (e) { console.error('TranslateFirst failed', e); setTranslateOptions([`(translation failed) ${String(e)}`]); } finally { setIsTranslating(false); }
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Have a Convo with LolaInParis :D Pick a Mode and Start Chatting</Text>
        <View style={styles.modeRow}>
          {/* map display labels to mode values */}
          {([
            { label: 'm1: LolaChat', value: 'm1' },
            // { label: 'm2', value: 'm2' },
            { label: 'm3: $ LolaVoice', value: 'm3' }
          ] as const).map(mb => (
            <TouchableOpacity key={mb.label} onPress={() => setMode(mb.value)} style={[styles.modeBtn, mode===mb.value && styles.modeBtnActive]}>
              <Text style={styles.modeText}>{mb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
        
     
      <FlatList
        data={messages}
        keyExtractor={(i, idx) => String(idx)}
        renderItem={({ item, index }) => (
          <View style={[styles.bubble, item?.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text>{item?.content}</Text>
            {item?.role === 'assistant' && mode === 'm3' && (
              <TouchableOpacity testID={`speak-${index}`} onPress={() => speakText(item?.content)} style={{ marginTop: 6 }}>
                <Text accessibilityLabel={`speak-${index}`}>🔊</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type..."
          multiline={true}
          blurOnSubmit={true}
          returnKeyType="send"
          onSubmitEditing={() => sendRef.current?.send && sendRef.current.send()}
          {...webKeyDownProps}
          onKeyPress={(e: any) => {
            // fallback for platforms that expose nativeEvent.key
            try {
              const key = e?.nativeEvent?.key;
              const shift = e?.nativeEvent?.shiftKey;
              const alt = e?.nativeEvent?.altKey;
              const ctrl = e?.nativeEvent?.ctrlKey;
              const meta = e?.nativeEvent?.metaKey;
              if (key === 'Enter' && !shift && !alt && !ctrl && !meta) {
                sendRef.current?.send && sendRef.current.send();
              }
            } catch (err) { /* ignore */ }
          }}
        />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: 6 }}>
            <Button title={isTranslating ? 'Translating...' : 'Translate First'} onPress={translateFirst} disabled={isTranslating} />
          </View>
          <SendButton ref={sendRef} text={text} setText={setText} messages={messages} setMessages={setMessages} mode={mode} />
        </View>
      </View>
      {translateOptions.length>0 && (<View style={styles.translatePanel}><Text style={{ fontWeight: '600', marginBottom: 6 }}>Choose a translation</Text>{translateOptions.map(opt=> (<TouchableOpacity key={opt} onPress={() => { setText(sanitizeVariant(opt)); setTranslateOptions([]); }} style={styles.translateOption}><Text>{opt}</Text></TouchableOpacity>))}</View>)}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex:1, padding: 12, backgroundColor: '#fff' },
  navbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: '#5b21b6' },
  navText: { color: '#eee', fontWeight: '600' },
  navTextActive: { color: '#fff', textDecorationLine: 'underline' },
  mainMenu: { padding: 16, alignItems: 'center' },
  subtitle: { marginTop: 8, color: '#6b21a8' },
  menuBtn: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 12, marginVertical: 8, width: '100%', maxWidth: 280, alignItems: 'center', alignSelf: 'center' },
  menuText: { color: '#fff', fontWeight: '700' },
  tabBtn: { padding: 8, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  tabActive: { backgroundColor: '#eee' },
  header: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  modeRow: { flexDirection: 'row', marginTop: 8 },
  modeBtn: { padding: 8, marginRight: 6, borderRadius: 6, borderWidth:1, borderColor:'#ccc' },
  modeBtnActive: { backgroundColor: '#eee' },
  modeText: {},
  bubble: { padding: 10, borderRadius: 8, marginVertical: 6, maxWidth: '80%' },
  userBubble: { backgroundColor: '#dcf8c6', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#f1f0f0', alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginRight: 8 }
  ,
  translatePanel: { padding: 10, backgroundColor: '#fff8e6', borderRadius: 8, marginTop: 10 },
  translateOption: { padding: 10, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', marginBottom: 8 }
});
