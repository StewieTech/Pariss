import client from "../lib/client";

  async function send() {
      const [messages, setMessages] = useState<any[]>([]);
        const [text, setText] = useState('');
          const [mode, setMode] = useState<'m1'|'m2'|'m3'>('m1');
        


    if (!text) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setText('');
    try {
      const res = await client.post(`${API}/chat/send`, { text: userMsg.content, mode });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data?.reply ?? '' }]);
    } catch (err: any) {
      console.error('API call failed', err);
      let message = 'Error calling API';
      try { if (err?.response) message = `API error ${err.response.status}: ${err.response.data?.error ?? JSON.stringify(err.response.data)}`; else if (err.request) message = 'No response from server (network or CORS)'; else message = String(err?.message || err); } catch(e){message=String(e);}      
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  }