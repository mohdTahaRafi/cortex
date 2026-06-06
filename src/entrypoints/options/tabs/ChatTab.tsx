import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MessageFactory } from '@/utils/message-factory';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface ChatTabProps {
  activeModel: string;
}

export default function ChatTab({ activeModel }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const listener = (msg: {
      action: string;
      payload: { chunk: string; done: boolean; requestId: string };
    }) => {
      if (msg.action === 'CHAT_CHUNK' && msg.payload.requestId === requestIdRef.current) {
        if (msg.payload.done) {
          setSending(false);
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
          );
        } else {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + msg.payload.chunk },
              ];
            }
            return [...prev, { role: 'assistant', content: msg.payload.chunk, streaming: true }];
          });
        }
      }
    };
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
    );
    return () =>
      chrome.runtime.onMessage.removeListener(
        listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
      );
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || sending || !activeModel) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const requestId = `chat_${Date.now()}`;
    requestIdRef.current = requestId;

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    chrome.runtime
      .sendMessage(MessageFactory.chatSend(allMessages, requestId))
      .catch(console.error);
  };

  if (!activeModel) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center dark">
        <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
          <Bot className="h-7 w-7 text-zinc-600" />
        </div>
        <h2 className="text-base font-semibold text-zinc-200 mb-2">No model loaded</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          Go to the Models tab, download and load a model to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 148px)' }}>
      {/* Header strip */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Chatting with{' '}
          <span className="text-violet-400 font-medium">
            {activeModel.replace(/-MLC$/, '')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMessages([])}
          className="h-7 gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-2 -mr-2">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 py-16 text-sm">
            Say hello — ask anything to test the model.
          </div>
        )}

        <div className="space-y-4 pb-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-linear-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-violet-900/30">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[78%] px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-violet-600/20 border border-violet-600/25 text-zinc-100 rounded-tr-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
                )}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2.5 mt-4 pt-4 border-t border-zinc-800">
        <Textarea
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={2}
          disabled={sending}
          className="resize-none bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500/40 focus-visible:border-violet-600 leading-relaxed"
        />
        <Button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="self-stretch px-4 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
