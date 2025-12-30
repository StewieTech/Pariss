import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Share,
  FlatList,
  Alert,
} from 'react-native';
import ChatBubble from '../components/ChatBubble';
import RoomChat from '../components/RoomChat';
import { usePvpRoom } from '../hooks/usePvpRoom';
import * as api from '../lib/api';
import { sanitizeVariant } from '../lib/sanitize';
import { API } from '../lib/config';
import { translateFirst as translateFirstUtil } from '../components/TranslateButton';

// Simple Tailwind-styled button
type ButtonProps = {
  title: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
};

function TwButton({ title, onPress, className = '', disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      className={`px-3 py-2 rounded-lg items-center justify-center ${
        disabled ? 'bg-gray-300' : 'bg-violet-600'
      } ${className}`}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Text
        className={`text-sm font-semibold ${
          disabled ? 'text-gray-600' : 'text-white'
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

type RoomSummary = {
  id: string;
  shareLink: string | null;
  participantCount?: number;
  createdAt?: number;
  updatedAt?: number;
  joinPath?: string;
  participants?: string[];
};

export default function PvPScreen() {
  const [tab, setTab] = useState<'live' | 'create' | 'suggest'>('live');
  const [input, setInput] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [name, setName] = useState('');
  const [createdRoom, setCreatedRoom] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  // New: track all rooms we've created or joined
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  const {
    participants,
    messages,
    setMessages,
    create,
    join,
    postMessage,
  translateFirst,
    suggestReplies,
    stopPolling,
  } = usePvpRoom();

  const [translateOptionsRoom, setTranslateOptionsRoom] = useState<string[]>(
    []
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);

  function setRoomsFromBackend(payload: any) {
    const list = (payload?.rooms || []) as any[];
    setRooms(
      list
        .map((r) => ({
          id: String(r.roomId || r.id || ''),
          shareLink: null,
          participantCount: Number(
            r.participantCount ??
              (Array.isArray(r.participants) ? r.participants.length : undefined)
          ),
          createdAt: Number(r.createdAt || 0) || undefined,
          updatedAt: Number(r.updatedAt || 0) || undefined,
          joinPath: String(r.joinPath || ''),
          participants: Array.isArray(r.participants) ? r.participants : undefined,
        }))
        .filter((r) => r.id)
    );
  }

  async function refreshRooms() {
    try {
      const out = await api.listPvpRooms(20);
      if (out?.ok) setRoomsFromBackend(out);
    } catch (e) {
      console.error('list rooms failed', e);
    }
  }

  useEffect(() => {
    refreshRooms();
  }, []);

  useEffect(() => {
    if (tab === 'live') refreshRooms();
  }, [tab]);

  async function handleCreate() {
    try {
      const r = await create();
      const id = r?.roomId;
      const invite =
        r?.inviteUrl || r?.joinPath || (id ? `${API}/pvp/${id}` : undefined);

      setCreatedRoom(id || null);
      setShareLink(invite || null);

      await refreshRooms();
    } catch (e) {
      console.error('create failed', e);
    }
  }

  async function handleJoin(id?: string) {
    const roomId = id || createdRoom;
    if (!roomId || !name) return;
    try {
      await join(roomId, name);
      setCreatedRoom(roomId);
      await refreshRooms();
    } catch (e) {
      console.error('join failed', e);
    }
  }

  async function handleSend(txt?: string) {
    const t = txt || input;
    if (!t) return;
    try {
      await postMessage(name || 'me', t);
      setInput('');
    } catch (e) {
      console.error('post failed', e);
    }
  }

  function parseRoomIdFromRaw(raw: string) {
    let id = raw;
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const parts = u.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('pvp');
        if (idx !== -1 && parts.length > idx + 1) id = parts[idx + 1];
        else id = parts[parts.length - 1] || id;
      } catch {
        id = raw.replace(/[^a-z0-9\-_.]/gi, '');
      }
    } else {
      id = raw.replace(/[^a-z0-9\-_.]/gi, '');
    }
    return id;
  }

  async function handleJoinByRaw(raw: string) {
    if (!name?.trim()) {
      Alert.alert('Missing name', 'Enter a display name before joining');
      return;
    }
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      Alert.alert('Missing link', 'Paste a link or room id first');
      return;
    }
    const id = parseRoomIdFromRaw(trimmed);
    await handleJoin(id);
  }

  async function handleCopyLink() {
    try {
      if (!shareLink) return;
      if (Platform.OS === 'web') {
        if ((navigator as any).clipboard?.writeText) {
          await (navigator as any).clipboard.writeText(shareLink);
          alert('Link copied');
          return;
        }
        window.prompt('Copy link', shareLink);
      } else {
        await Share.share({ message: shareLink });
      }
    } catch (e) {
      console.warn('copy failed', e);
      try {
        window.prompt('Copy link', shareLink || '');
      } catch (err) {
        console.warn('fallback copy failed', err);
      }
    }
  }

  async function handleTranslateFirst() {
    if (!input) return;
    try {
      const r = await api.translateFirst(input);
      const variants: string[] = r?.variants ?? [];
      setTranslateOptionsRoom(variants.slice(0, 3));
    } catch (e) {
      console.error('translateFirst failed', e);
    }
  }

  async function handleAskLola() {
    if (!input) return;
    try {
      const id = createdRoom || '';
      const r = await suggestReplies(id, input);
      if (r && r.length) setInput(r[0]);
    } catch (e) {
      console.error('suggest failed', e);
    }
  }

  async function getSuggestions() {
    if (!input) return;
    try {
      const r = await api.translateFirst(input);
      const variants: string[] = r?.variants ?? [];
      setSuggestions(variants.slice(0, 3));
    } catch (e) {
      setSuggestions([`(failed) ${String(e)}`]);
    }
  }

  return (
    <View className="flex-1 bg-white p-3">
      <Text className="text-2xl font-semibold mb-3 text-violet-900">
        Talk to Friends in French
      </Text>

      {/* Tabs: Live | Create Room | Suggest Replies */}
      <View className="flex-row mb-3">
        <TouchableOpacity
          className={`px-3 py-2 rounded-full mr-2 border ${
            tab === 'live'
              ? 'bg-violet-100 border-violet-500'
              : 'bg-white border-gray-300'
          }`}
          onPress={() => setTab('live')}
        >
          <Text
            className={`text-sm ${
              tab === 'live' ? 'text-violet-800 font-semibold' : 'text-gray-700'
            }`}
          >
            Live Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`px-3 py-2 rounded-full mr-2 border ${
            tab === 'create'
              ? 'bg-violet-100 border-violet-500'
              : 'bg-white border-gray-300'
          }`}
          onPress={() => setTab('create')}
        >
          <Text
            className={`text-sm ${
              tab === 'create'
                ? 'text-violet-800 font-semibold'
                : 'text-gray-700'
            }`}
          >
            Create a Room
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`px-3 py-2 rounded-full border ${
            tab === 'suggest'
              ? 'bg-violet-100 border-violet-500'
              : 'bg-white border-gray-300'
          }`}
          onPress={() => setTab('suggest')}
        >
          <Text
            className={`text-sm ${
              tab === 'suggest'
                ? 'text-violet-800 font-semibold'
                : 'text-gray-700'
            }`}
          >
            Suggest Replies
          </Text>
        </TouchableOpacity>
      </View>

      {/* LIVE TAB */}
      {tab === 'live' && (
        <View className="flex-1">
          {/* Active rooms list */}
          <View className="mb-4">
            <Text className="text-base font-semibold text-gray-900 mb-2">
              Active Rooms
            </Text>

            {rooms.length > 0 ? (
              <View className="space-y-2">
                {rooms.map((room) => {
                  const isCurrent = room.id === createdRoom;
                  return (
                    <TouchableOpacity
                      key={room.id}
                      className={`p-3 rounded-lg border ${
                        isCurrent
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onPress={() => {
                        setJoinInput(room.id);
                        handleJoin(room.id);
                      }}
                    >
                      <Text className="text-sm font-semibold text-gray-900">
                        Room ID: {room.id}
                      </Text>
                      <Text className="text-xs text-gray-700 mt-1">
                        Participants: {typeof room.participantCount === 'number' ? room.participantCount : (isCurrent ? participants.length : '—')}
                      </Text>
                      {room.joinPath && (
                        <Text
                          className="text-xs text-gray-600 mt-1"
                          numberOfLines={1}
                        >
                          {room.joinPath}
                        </Text>
                      )}
                      {isCurrent && participants.length > 0 && (
                        <Text className="text-xs text-violet-700 mt-1">
                          Participants: {participants.join(', ')}
                        </Text>
                      )}
                      {!isCurrent && (
                        <Text className="text-xs text-gray-600 mt-1">
                          Tap to join this room
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TouchableOpacity
                className="p-4 rounded-lg border border-dashed border-violet-400 bg-violet-50 items-center justify-center"
                onPress={() => setTab('create')}
              >
                <Text className="text-sm font-semibold text-violet-800">
                  Create a ChatRoom
                </Text>
                <Text className="text-xs text-violet-700 mt-1">
                  Tap to create your first room
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Join by link / id */}
          <View className="mb-4">
            <Text className="mb-2 text-gray-800">
              Or paste an invite URL / room id to join:
            </Text>
            <TextInput
              className="border border-gray-300 rounded-md px-3 py-2 mb-2"
              placeholder="Paste link or room id"
              value={joinInput}
              onChangeText={setJoinInput}
            />
            <TextInput
              className="border border-gray-300 rounded-md px-3 py-2"
              placeholder="Your display name"
              value={name}
              onChangeText={setName}
            />
            <View className="flex-row mt-3">
              <TwButton
                title="Join by Link/ID"
                onPress={() => handleJoinByRaw(joinInput)}
              />
            </View>
          </View>

          </View>
      )}

      {/* CREATE ROOM TAB */}
      {tab === 'create' && (
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Create a Room
          </Text>
          <Text className="mb-3 text-gray-800">
            Create an invite link and share it with a friend.
          </Text>

          <TwButton title="Create Invite" onPress={handleCreate} />

          {createdRoom && (
            <View className="mt-4">
              <Text className="mb-2 text-gray-800">
                Share this link with your friend:
              </Text>
              <Text
                selectable
                className="text-gray-700 mb-2 text-xs bg-gray-100 p-2 rounded-md"
              >
                {shareLink}
              </Text>
              <View className="flex-row">
                <TwButton
                  title="Copy Link"
                  onPress={handleCopyLink}
                  className="bg-violet-500"
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* SUGGEST TAB */}
      {tab === 'suggest' && (
        <View className="flex-1">
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2"
            value={input}
            onChangeText={setInput}
            placeholder="Paste French text here"
          />
          <View className="flex-row mt-3">
            <TwButton title="Get Suggestions" onPress={getSuggestions} />
          </View>
          <View className="mt-3">
            {suggestions.map((s) => (
              <View
                key={s}
                className="mb-2 px-3 py-2 rounded-md bg-white border border-gray-200"
              >
                <Text className="text-gray-800">{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ROOM CHAT VIEW: when a room is active, show dedicated UI overlay */}
{createdRoom && (
  <RoomChat
    roomId={createdRoom}
    participants={participants}
    messages={messages}
    setMessages={setMessages}
    onSend={async (t: string, opts) => {
      await postMessage(name || 'me', t, opts);
    }}
    onLeave={() => {
      stopPolling();
      setCreatedRoom(null);
      setShareLink(null);
      setInput('');
    }}
    currentUserName={name || 'me'}
  />
)}

    </View>
  );
}
