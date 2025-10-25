import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { speakText } from './app/services/voice';
import axios from 'axios';
import { sanitizeVariant, parseRoomIdFromRaw } from './app/lib/utils';
import NavBar from './app/components/NavBar';
import MainMenu from './app/components/MainMenu';
const EXPO_API_URL = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';
// const EXPO_API_URL = '';
const DEFAULT_LOCAL = 'http://192.168.2.44:4000'; // local dev fallback (no /api/v1 appended yet)


// const API_BASE = EXPO_API_URL ;
const API_BASE = DEFAULT_LOCAL ;
// const API_BASE = EXPO_API_URL || DEFAULT_LOCAL;
const API = `${API_BASE}`;
// log the computed API for debugging in the browser console
if (typeof console !== 'undefined') console.log('Lola Demo API base:', API_BASE);

// sanitizeVariant moved to app/lib/utils.ts and imported above

export default function App() {
  const [screen, setScreen] = useState<'main'|'pve'|'pvp'>('main');

  return (
    <SafeAreaView style={styles.container}>
      <NavBar current={screen} onNav={setScreen} />
      {screen === 'main' && <MainMenu onChoose={setScreen} />}
      {screen === 'pve' && <PvE />}
      {screen === 'pvp' && <PvP />}
    </SafeAreaView>
  );
}


// NavBar and MainMenu extracted to app/components for testability

function PvE() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // ...existing chat logic moved here...
  useEffect(() => {
    axios.get(`${API}/history?limit=20`).then(r => setMessages(r.data.messages.reverse())).catch(()=>{});
  }, []);

  // using shared sanitizeVariant from app/lib/utils

  async function send() {
    if (!text) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setText('');
    try {
      const res = await axios.post(`${API}/chat/send`, { text: userMsg.content, mode });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply ?? '' }]);
    } catch (err: any) {
      console.error('API call failed', err);
      let message = 'Error calling API';
      try { if (err?.response) message = `API error ${err.response.status}: ${err.response.data?.error ?? JSON.stringify(err.response.data)}`; else if (err.request) message = 'No response from server (network or CORS)'; else message = String(err?.message || err); } catch(e){message=String(e);}      
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  }

  async function translateFirst() {
    if (!text) return;
    setIsTranslating(true); setTranslateOptions([]);
    try {
      const res = await axios.post(`${API}/chat/translate`, { text });
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
            { label: 'm2', value: 'm2' },
            { label: 'm3: LolaVoice', value: 'm3' }
          ] as const).map(mb => (
            <TouchableOpacity key={mb.label} onPress={() => setMode(mb.value)} style={[styles.modeBtn, mode===mb.value && styles.modeBtnActive]}>
              <Text style={styles.modeText}>{mb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(i,idx)=>String(idx)}
        renderItem={({item, index}) => (
          <View style={[styles.bubble, item.role==='user' ? styles.userBubble : styles.assistantBubble]}>
            <Text>{item.content}</Text>
            {item.role === 'assistant' && mode === 'm3' && (
              <TouchableOpacity testID={`speak-${index}`} onPress={() => speakText(item.content)} style={{ marginTop: 6 }}>
                <Text accessibilityLabel={`speak-${index}`}>🔊</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Type..." />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: 6 }}>
            <Button title={isTranslating ? 'Translating...' : 'Translate First'} onPress={translateFirst} disabled={isTranslating} />
          </View>
          <Button title="Send" onPress={send} />
        </View>
      </View>
      {translateOptions.length>0 && (<View style={styles.translatePanel}><Text style={{ fontWeight: '600', marginBottom: 6 }}>Choose a translation</Text>{translateOptions.map(opt=> (<TouchableOpacity key={opt} onPress={() => { setText(sanitizeVariant(opt)); setTranslateOptions([]); }} style={styles.translateOption}><Text>{opt}</Text></TouchableOpacity>))}</View>)}
    </View>
  );
}

function PvP() {
  const [tab, setTab] = useState<'live'|'suggest'|'tbd'>('live');
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Live chat states
  const [createdRoom, setCreatedRoom] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [name, setName] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [messagesLive, setMessagesLive] = useState<{ name: string; text: string; ts: number }[]>([]);
  const [translateOptionsRoom, setTranslateOptionsRoom] = useState<string[]>([]);

  // polling handle
  const [pollHandle, setPollHandle] = useState<any>(null);

  async function getSuggestions() {
    if (!input) return;
    try {
      const res = await axios.post(`${API}/chat/translate`, { text: input });
      const variants: string[] = res?.data?.variants ?? [];
      setSuggestions(variants.slice(0,3));
    } catch (e) { setSuggestions([`(failed) ${String(e)}`]); }
  }

  async function createRoom() {
    try {
      const res = await axios.post(`${API}/pvp/create`, {});
      const id = res?.data?.roomId;
      const path = res?.data?.joinPath;
      setCreatedRoom(id || null);
      setShareLink(id ? `${API}${path}` : null);
    } catch (e) {
      console.error('createRoom failed', e);
    }
  }

  async function joinExistingRoom(id?: string) {
    const roomId = id || createdRoom;
    if (!roomId || !name) return;
    try {
      const res = await axios.post(`${API}/pvp/${roomId}/join`, { name });
      setJoinedRoom(roomId);
      setParticipants(res.data.participants || []);
      setMessagesLive(res.data.messages || []);
      // start polling
      if (pollHandle) clearInterval(pollHandle);
      const h = setInterval(async () => {
        try {
          const s = await axios.get(`${API}/pvp/${roomId}`);
          setParticipants(s.data.participants || []);
          setMessagesLive(s.data.messages || []);
        } catch (er) {
          console.warn('poll error', er);
        }
      }, 2000);
      setPollHandle(h);
    } catch (e) {
      console.error('joinRoom failed', e);
    }
  }

  async function leaveRoom() {
    if (pollHandle) { clearInterval(pollHandle); setPollHandle(null); }
    setJoinedRoom(null);
    setParticipants([]);
    setMessagesLive([]);
  }

  async function sendLiveMessage(text?: string) {
    const roomId = joinedRoom || createdRoom;
    const txt = (text ?? input) || '';
    if (!roomId || !name || !txt) return;
    try {
      const res = await axios.post(`${API}/pvp/${roomId}/message`, { name, text: txt });
      // optimistic append
      setMessagesLive(prev => [...prev, res.data.message]);
      setInput('');
    } catch (e) {
      console.error('sendLiveMessage failed', e);
    }
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={styles.title}>Talk to Friends in French</Text>
      <View style={{ flexDirection: 'row', marginVertical: 8 }}>
        <TouchableOpacity style={[styles.tabBtn, tab==='live' && styles.tabActive]} onPress={() => setTab('live')}><Text>Live Chat</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab==='suggest' && styles.tabActive]} onPress={() => setTab('suggest')}><Text>Suggest Replies</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab==='tbd' && styles.tabActive]} onPress={() => setTab('tbd')}><Text>TBD</Text></TouchableOpacity>
      </View>

      {tab === 'live' && (
        <View>
          {!createdRoom && !joinedRoom && (
            <View>
              <Text style={{ marginBottom: 8 }}>Create an invite link and share it with a friend.</Text>
              <Button title="Create Invite" onPress={createRoom} />
              <View style={{ height: 12 }} />
              <Text style={{ marginBottom: 8 }}>Or paste an invite URL / room id to join:</Text>
              <TextInput style={styles.input} placeholder="Paste link or room id" value={joinInput} onChangeText={setJoinInput} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Your display name" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Join by Link/ID" onPress={() => {
                  if (!name?.trim()) { alert('Enter a display name before joining'); return; }
                  const raw = (joinInput || '').trim();
                  if (!raw) return alert('Paste a link or room id first');
                  const id = parseRoomIdFromRaw(raw);
                  joinExistingRoom(id);
                }} />
              </View>
            </View>
          )}

          {!!createdRoom && !joinedRoom && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ marginBottom: 8 }}>Share this link with your friend:</Text>
              <Text selectable style={{ color: '#444', marginBottom: 8 }}>{shareLink}</Text>
              <TextInput style={styles.input} placeholder="Your display name" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Join Room" onPress={() => joinExistingRoom(createdRoom || undefined)} />
                <View style={{ width: 12 }} />
                <Button title="Copy Link" onPress={async () => {
                  try {
                    if (!shareLink) return;
                    if (Platform.OS === 'web') {
                      if ((navigator as any).clipboard?.writeText) {
                        await (navigator as any).clipboard.writeText(shareLink);
                        alert('Link copied to clipboard');
                        return;
                      }
                      // fallback to prompt
                      window.prompt('Copy the link', shareLink);
                    } else {
                      await Share.share({ message: shareLink });
                    }
                  } catch (e) {
                    console.warn('copy link failed', e);
                    try { window.prompt('Copy the link', shareLink); } catch(err) { console.warn(err); }
                  }
                }} />
              </View>
            </View>
          )}

          {!!joinedRoom && (
            <View>
              <Text style={{ fontWeight: '600' }}>Room: {joinedRoom}</Text>
              <Text>Participants: {participants.join(', ')}</Text>
              <View style={{ height: 12 }} />
              <FlatList data={messagesLive} keyExtractor={(m,i)=>String(i)} renderItem={({item}) => (<View style={styles.translateOption}><Text style={{ fontWeight: '700' }}>{item.name}:</Text><Text>{' '}{item.text}</Text></View>)} />
              <TextInput style={styles.input} placeholder="Message" value={input} onChangeText={setInput} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Send" onPress={() => sendLiveMessage()} />
                <View style={{ width: 12 }} />
                <Button title="Translate First" onPress={async () => {
                  if (!input) return;
                  try {
                    const r = await axios.post(`${API}/chat/translate`, { text: input });
                    const variants: string[] = r?.data?.variants ?? [];
                    setTranslateOptionsRoom(variants.slice(0,3));
                  } catch (e) { console.error('translate in room failed', e); }
                }} />
                <View style={{ width: 12 }} />
                <Button title="Ask Lola" onPress={async () => {
                  if (!input) return;
                  try {
                    const id = joinedRoom || createdRoom;
                    if (!id) return;
                    const r = await axios.post(`${API}/pvp/${id}/suggest`, { text: input });
                    const vars: string[] = r?.data?.variants ?? [];
                    // show as quick options below
                    if (vars.length) {
                      // place first suggestion into input
                      setInput(vars[0]);
                    }
                  } catch (e) { console.error('suggest in room failed', e); }
                }} />
                <View style={{ width: 12 }} />
                <Button title="Leave" onPress={leaveRoom} />
              </View>
              {translateOptionsRoom.length > 0 && (
                <View style={styles.translatePanel}>
                  <Text style={{ fontWeight: '600', marginBottom: 6 }}>Choose a translation</Text>
                  {translateOptionsRoom.map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => { setInput(sanitizeVariant(opt)); setTranslateOptionsRoom([]); }} style={styles.translateOption}>
                      <Text>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {tab === 'suggest' && (
        <View>
          <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Paste French text here" />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Button title="Get Suggestions" onPress={getSuggestions} />
          </View>
          <View style={{ marginTop: 12 }}>
            {suggestions.map(s => (<View key={s} style={styles.translateOption}><Text>{s}</Text></View>))}
          </View>
        </View>
      )}

      {tab === 'tbd' && (
        <View><Text>Feature idea: "Role-play mode" where friends take character roles and practice dialogues.</Text></View>
      )}
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
  menuBtn: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 12, marginVertical: 8, width: 280, alignItems: 'center' },
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
