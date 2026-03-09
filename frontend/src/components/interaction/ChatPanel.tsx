import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "agent" | "system";
  content: string;
  agentName?: string;
}

export function ChatPanel({ messages, onSend }: {
  messages: Message[];
  onSend: (content: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-[500px]">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-navy text-sm">Agent Chat</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-8">No messages yet</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-violet text-white"
                : msg.role === "system"
                ? "bg-gray-100 text-gray-500 text-xs"
                : "bg-gray-100 text-gray-800"
            }`}>
              {msg.agentName && <div className="text-[10px] text-gray-400 mb-0.5">{msg.agentName}</div>}
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-violet" />
        <button type="submit" disabled={!input.trim()}
          className="bg-navy text-white px-4 py-2 rounded text-sm hover:bg-navy/90 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
