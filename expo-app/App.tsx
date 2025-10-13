import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';

// Configure API host: prefer EXPO_API_URL env var (set during build or via app config).
// Example for deployed Lambda Function URL: https://xxxx.lambda-url.ca-central-1.on.aws
// const EXPO_API_URL = process.env.EXPO_API_URL;
const EXPO_API_URL = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';
const DEFAULT_LOCAL = 'http://192.168.2.44:4000'; // local dev fallback (no /api/v1 appended yet)

// Compute API base robustly so the app never calls 'undefined'.
function computeApiBase() {
  // 1) prefer explicit EXPO_API_URL injected at build time
  if (EXPO_API_URL && EXPO_API_URL.trim()) return EXPO_API_URL.replace(/\/$/, '');

  // 2) when running as an exported Expo web app, extras can land on window.__EXPO_CONFIG__
  try {
    // @ts-ignore - window may not have this in every environment
    const win: any = typeof window !== 'undefined' ? window : undefined;
    const expoConfig = win && win.__EXPO_CONFIG__;
    const extras = expoConfig && expoConfig.extra;
    if (extras && extras.EXPO_API_URL) return String(extras.EXPO_API_URL).replace(/\/$/, '');
  } catch (e) {
    // ignore
  }

  // 3) fallback to local dev host
  return DEFAULT_LOCAL;
}

const API_BASE = computeApiBase();
// const API = `${API_BASE}/api/v1`;
const API = `${API_BASE}`;
// log the computed API for debugging in the browser console
if (typeof console !== 'undefined') console.log('Lola Demo API base:', API_BASE);

export default function App() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');

  useEffect(() => {
    // fetch history
    axios.get(`${API}/history?limit=20`).then(r => setMessages(r.data.messages.reverse())).catch(()=>{});
  }, []);

  async function send() {
    if (!text) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setText('');
    try {
      const res = await axios.post(`${API}/chat/send`, { text: userMsg.content, mode });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      // log full error for debugging (network, status, response)
      console.error('API call failed', err);
      let message = 'Error calling APII';
      try {
        if (err.response) {
          // axios error with response from server
          message = `API error ${err.response.status}: ${err.response.data?.error || JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          // no response received
          message = 'No response from server (network or CORS)';
        } else {
          message = String(err.message || err);
        }
      } catch (e) {
        message = String(err);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lola Demo</Text>
        <View style={styles.modeRow}>
          {(['m1','m2','m3'] as const).map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode===m && styles.modeBtnActive]}>
              <Text style={styles.modeText}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item, idx) => String(idx)}
        renderItem={({item}) => (
          <View style={[styles.bubble, item.role==='user' ? styles.userBubble : styles.assistantBubble]}>
            <Text>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Type..." />
        <Button title="Send" onPress={send} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding: 12, backgroundColor: '#fff' },
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
});
