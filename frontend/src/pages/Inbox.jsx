import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Inbox() {
  const { phone: phoneParam } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const selectedPhone = phoneParam ? decodeURIComponent(phoneParam) : null;

  const loadConversations = async () => {
    try {
      const { data } = await api.get('/inbox');
      setConversations(data.conversations || []);
    } catch (e) {
      toast.error('Failed to load inbox');
    }
  };

  const loadThread = async (phone) => {
    if (!phone) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.get(`/inbox/${encodeURIComponent(phone)}`);
      setMessages(data.messages || []);
      await api.put(`/inbox/${encodeURIComponent(phone)}/read`);
      loadConversations();
    } catch (e) {
      toast.error('Failed to load thread');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedPhone) loadThread(selectedPhone);
  }, [selectedPhone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
  const lastInboundTime = lastInbound?.received_at ? new Date(lastInbound.received_at) : null;
  const windowExpired =
    !lastInboundTime || Date.now() - lastInboundTime.getTime() > 24 * 60 * 60 * 1000;

  const send = async () => {
    if (!selectedPhone || !text.trim()) return;
    setSending(true);
    try {
      await api.post(`/inbox/${encodeURIComponent(selectedPhone)}/reply`, { text: text.trim() });
      setText('');
      await loadThread(selectedPhone);
      toast.success('Sent');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="w-full max-w-sm overflow-y-auto border-r border-gray-100">
        {loading ? (
          <div className="p-4 text-gray-500">Loading…</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.phone}
              type="button"
              onClick={() => navigate(`/inbox/${encodeURIComponent(c.phone)}`)}
              className={`flex w-full flex-col items-start border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${
                selectedPhone === c.phone ? 'bg-wa-green/10' : ''
              }`}
            >
              <div className="flex w-full justify-between gap-2">
                <span className="font-medium text-gray-900">{c.contact_name || c.phone}</span>
                {Number(c.unread) > 0 && (
                  <span className="rounded-full bg-red-500 px-2 text-xs text-white">{c.unread}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">{c.phone}</span>
              <p className="mt-1 line-clamp-2 text-xs text-gray-600">{c.last_message}</p>
              <span className="mt-1 text-2xs text-gray-400">
                {c.last_at ? new Date(c.last_at).toLocaleString() : ''}
              </span>
            </button>
          ))
        )}
        {!loading && !conversations.length && (
          <div className="p-6 text-center text-gray-500">No conversations yet</div>
        )}
      </div>
      <div className="flex flex-1 flex-col">
        {!selectedPhone && (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Select a conversation
          </div>
        )}
        {selectedPhone && (
          <>
            <div className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">
              {selectedPhone}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#e5ddd5] p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow ${
                      m.direction === 'outbound'
                        ? 'bg-[#dcf8c6] text-gray-900'
                        : 'bg-white text-gray-900'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {windowExpired && (
              <div className="border-t border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-900">
                24-hour messaging window expired. Customer must message you again to reply.
              </div>
            )}
            <div className="flex gap-2 border-t border-gray-100 p-3">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Type a reply…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={windowExpired || sending}
              />
              <button
                type="button"
                onClick={send}
                disabled={windowExpired || sending}
                className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
