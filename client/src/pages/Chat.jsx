import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function Chat() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [otherName, setOtherName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const load = () => {
    api
      .matchMessages(token, id)
      .then(({ messages }) => setMessages(messages))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token]);

  useEffect(() => {
    api.matches(token).then(({ matches }) => {
      const m = matches.find((x) => String(x.id) === String(id));
      if (m) setOtherName(m.otherUser?.name || '');
    });
  }, [id, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text;
    setText('');
    await api.sendMessage(token, id, body);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-3">
        <Link to="/matches" className="text-sm text-rose-500 hover:underline">
          ← Matches
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{otherName || 'Chat'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-400">Say hi 👋</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <button
          type="submit"
          className="bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-full px-5 py-2 text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}
