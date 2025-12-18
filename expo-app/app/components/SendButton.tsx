import { Button, Alert } from 'react-native';
import { forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { API } from "../lib/config";
import client from "../lib/client";

type Props = {
  text: string;
  setText: (t: string) => void;
  messages: any[];
  setMessages: (m: any[] | ((prev: any[]) => any[])) => void;
  // Optional override send handler; when provided, uses this instead of default chat/send
  onSend?: (text: string) => Promise<void> | void;
  // Optional mode for backend chat
  mode?: 'm1' | 'm2' | 'm3';
  disabled?: boolean;
};

const SendButton = forwardRef(function SendButton({ text, setText, messages, setMessages, onSend, mode, disabled }: Props, ref) {
  const [isSending, setIsSending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // immediate sending lock to prevent duplicate sends within the same event loop
  const sendingRef = useRef(false);

  async function sendAction() {
    if (!text || disabled) return;
    if (sendingRef.current) return; // avoid duplicate sends immediately
    sendingRef.current = true;
    setIsSending(true);
    const userMsg = { role: 'user', content: text };
    try {
      // optimistic update: show user message immediately
      setMessages((prev: any[]) => [...prev, userMsg]);
      setText('');

      if (onSend) {
        await Promise.resolve(onSend(userMsg.content));
      } else {
        const res = await client.post(`${API}/chat/send`, { text: userMsg.content, mode });
        const reply = res?.data?.reply ?? '';
        setMessages((prev: any[]) => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (err: any) {
      console.error('API call failed', err);
      let message = 'Error calling API';
      try {
        if (err?.response) message = `API error ${err.response.status}: ${err.response.data?.error ?? JSON.stringify(err.response.data)}`;
        else if (err.request) message = 'No response from server (network or CORS)';
        else message = String(err?.message || err);
      } catch (e) { message = String(e); }
      setMessages((prev: any[]) => [...prev, { role: 'assistant', content: message }]);
      // optionally notify the user
      // Alert.alert('Send failed', message);
    } finally {
      // add a small cooldown so accidental double taps don't resend
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        setIsSending(false);
        sendingRef.current = false; // release immediate lock after cooldown
        cooldownRef.current = null;
      }, 800);
    }
  }

  // Expose send() so parent can trigger on Enter
  useImperativeHandle(ref, () => ({ send: sendAction }), [text, disabled, mode, messages, isSending]);

  return <Button title={isSending ? 'Sending...' : 'TheSend'} onPress={sendAction} disabled={Boolean(disabled) || isSending} />;
});

export default SendButton;