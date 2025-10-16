import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, Platform, Share } from 'react-native';
import ChatBubble from '../components/ChatBubble';
import MessageInput from '../components/MessageInput';
import { usePvpRoom } from '../hooks/usePvpRoom';
import styles from '../styles';
import * as api from '../lib/api';
import { sanitizeVariant } from '../lib/sanitize';
import { API } from '../lib/config';

export default function PvPScreen(){
  const [tab, setTab] = useState<'live'|'suggest'|'tbd'>('live');
  const [input, setInput] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [name, setName] = useState('');
  const [createdRoom, setCreatedRoom] = useState<string|null>(null);
  const [shareLink, setShareLink] = useState<string|null>(null);
  const { participants, messages, create, join, postMessage, translateFirst, suggestReplies, stopPolling } = usePvpRoom();
  const [translateOptionsRoom, setTranslateOptionsRoom] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function handleCreate(){
    try{
      const r = await create();
      const id = r?.roomId;
      const invite = r?.inviteUrl || r?.joinPath || (id ? `${API}/pvp/${id}` : undefined);
      setCreatedRoom(id||null);
      setShareLink(invite||null);
    }catch(e){ console.error('create failed', e); }
  }

  async function handleJoin(id?:string){
    const roomId = id || createdRoom;
    if (!roomId || !name) return;
    try{ await join(roomId, name); } catch(e){ console.error('join failed', e); }
  }

  async function handleSend(txt?:string){
    const t = txt || input;
    if (!t) return;
    try{ await postMessage(name||'me', t); setInput(''); } catch(e){ console.error('post failed', e); }
  }

  function parseRoomIdFromRaw(raw:string){
    let id = raw;
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const parts = u.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('pvp');
        if (idx !== -1 && parts.length > idx+1) id = parts[idx+1];
        else id = parts[parts.length-1] || id;
      } catch {
        id = raw.replace(/[^a-z0-9\-_.]/ig,'');
      }
    } else {
      id = raw.replace(/[^a-z0-9\-_.]/ig,'');
    }
    return id;
  }

  async function handleJoinByRaw(raw:string){
    if (!name?.trim()) { alert('Enter a display name before joining'); return; }
    const trimmed = (raw||'').trim(); if (!trimmed) return alert('Paste a link or room id first');
    const id = parseRoomIdFromRaw(trimmed);
    await handleJoin(id);
  }

  async function handleCopyLink(){
    try{
      if (!shareLink) return;
      if (Platform.OS==='web'){
        if ((navigator as any).clipboard?.writeText){
          await (navigator as any).clipboard.writeText(shareLink);
          alert('Link copied');
          return;
        }
        window.prompt('Copy link', shareLink);
      } else {
        await Share.share({ message: shareLink });
      }
    } catch(e){
      console.warn('copy failed', e);
      try{ window.prompt('Copy link', shareLink); }catch(err){ console.warn('fallback copy failed', err); }
    }
  }

  async function handleTranslateFirst(){
    if (!input) return;
    try{ const r = await translateFirst(input); setTranslateOptionsRoom(r.slice(0,3)); } catch(e){ console.error('translateFirst failed', e); }
  }

  async function handleAskLola(){
    if (!input) return;
    try{ const id = createdRoom || ''; const r = await suggestReplies(id, input); if (r && r.length) setInput(r[0]); } catch(e){ console.error('suggest failed', e); }
  }

  async function getSuggestions(){
    if (!input) return;
    try{ const r = await api.translateFirst(input); const variants:string[] = r?.variants ?? []; setSuggestions(variants.slice(0,3)); } catch(e){ setSuggestions([`(failed) ${String(e)}`]); }
  }

  return (
    <View style={{ flex:1, padding:12 }}>
      <Text style={styles.title}>Talk to Friends in French</Text>
      <View style={{ flexDirection:'row', marginVertical:8 }}>
        <TouchableOpacity style={[styles.tabBtn, tab==='live' && styles.tabActive]} onPress={()=>setTab('live')}><Text>Live Chat</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab==='suggest' && styles.tabActive]} onPress={()=>setTab('suggest')}><Text>Suggest Replies</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab==='tbd' && styles.tabActive]} onPress={()=>setTab('tbd')}><Text>TBD</Text></TouchableOpacity>
      </View>

      {tab==='live' && (
        <View>
          {!createdRoom && (
            <View>
              <Text style={{ marginBottom: 8 }}>Create an invite link and share it with a friend.</Text>
              <Button title="Create Invite" onPress={handleCreate} />
              <View style={{ height: 12 }} />
              <Text style={{ marginBottom: 8 }}>Or paste an invite URL / room id to join:</Text>
              <TextInput style={styles.input} placeholder="Paste link or room id" value={joinInput} onChangeText={setJoinInput} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Your display name" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Join by Link/ID" onPress={() => handleJoinByRaw(joinInput)} />
              </View>
            </View>
          )}

          {!!createdRoom && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ marginBottom: 8 }}>Share this link with your friend:</Text>
              <Text selectable style={{ color: '#444', marginBottom: 8 }}>{shareLink}</Text>
              <TextInput style={styles.input} placeholder="Your display name" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Join Room" onPress={() => handleJoin(createdRoom||undefined)} />
                <View style={{ width: 12 }} />
                <Button title="Copy Link" onPress={handleCopyLink} />
              </View>
            </View>
          )}

          <View>
            <Text>Participants: {participants.join(', ')}</Text>
            <View style={{ height: 12 }} />
            <FlatList data={messages} keyExtractor={(m,i)=>String(i)} renderItem={({item}) => (<ChatBubble author={item.name} text={item.text} />)} />
            <MessageInput value={input} onChange={setInput} onSend={() => handleSend()} />
            <View style={{ flexDirection:'row', marginTop:8 }}>
              <Button title="Translate First" onPress={handleTranslateFirst} />
              <View style={{ width:12 }} />
              <Button title="Ask Lola" onPress={handleAskLola} />
              <View style={{ width:12 }} />
              <Button title="Leave" onPress={() => { stopPolling(); setCreatedRoom(null); setShareLink(null); setInput(''); }} />
            </View>
            {translateOptionsRoom.length>0 && (<View style={styles.translatePanel}><Text style={{ fontWeight: '600', marginBottom: 6 }}>Choose a translation</Text>{translateOptionsRoom.map(opt => (<TouchableOpacity key={opt} onPress={() => { setInput(sanitizeVariant(opt)); setTranslateOptionsRoom([]); }} style={styles.translateOption}><Text>{opt}</Text></TouchableOpacity>))}</View>)}
          </View>
        </View>
      )}

      {tab === 'suggest' && (
        <View>
          <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Paste French text here" />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Button title="Get Suggestions" onPress={getSuggestions} />
          </View>
          <View style={{ marginTop: 12 }}>
            {suggestions.map((s)=>(<View key={s} style={styles.translateOption}><Text>{s}</Text></View>))}
          </View>
        </View>
      )}

      {tab === 'tbd' && (
        <View><Text>Feature idea: "Role-play mode" where friends take character roles and practice dialogues.</Text></View>
      )}
    </View>
  );
}
