import { useRef, useState } from "react";
import client from "../lib/client";
import { API } from "../lib/config";
import styles from "../styles";
import SendButton from "../components/SendButton";
import { sanitizeVariant } from "../lib/utils";
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, Platform } from 'react-native';
import { speakText } from '../../app/services/voice';



export default function PvEScreen() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
  const sendRef = useRef<{ send?: () => void } | null>(null);
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  // track which assistant message index is currently speaking/loading
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

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
              <TouchableOpacity
                testID={`speak-${index}`}
                style={{ marginTop: 6 }}
                onPress={async () => {
                  if (!item?.content) return;
                  try {
                    setSpeakingIdx(index);
                    await speakText(item.content);
                  } catch (e) {
                    console.warn('speak failed', e);
                  } finally {
                    setSpeakingIdx((cur) => (cur === index ? null : cur));
                  }
                }}
              >
                <Text
                  accessibilityLabel={`speak-${index}`}
                  style={{ color: '#6D28D9', fontSize: 13 }}
                >
                  {speakingIdx === index ? '⏳ Loading voice…' : '🔊 Click to hear Lola :)'}
                </Text>
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