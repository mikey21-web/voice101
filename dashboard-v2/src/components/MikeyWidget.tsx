import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { runUIActions, confirmPendingAction, type CopilotAction } from "../lib/copilotActions";
import MarkdownMessage from "./MarkdownMessage";
import toast from "react-hot-toast";
import { Send, MessageCircle, Loader2, X, MessageSquare, ChevronDown, ChevronUp, CircleCheck, AlertTriangle, Circle } from "lucide-react";

interface Message {
  id: string; role: string; content: string; createdAt: string; toolCalls?: CopilotAction[];
}

export default function MikeyWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() }]);

    try {
      const res = await api("/copilot/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, conversationId: convId }),
      });
      if (res.conversationId && res.conversationId !== convId) setConvId(res.conversationId);
      setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: "assistant", content: res.reply, createdAt: new Date().toISOString(), toolCalls: res.actions || [] }]);
      runUIActions(res.actions, res.reply);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: `Error: ${e.message}`, createdAt: new Date().toISOString() }]);
    }
    setSending(false);
  };

  const handleConfirm = async (messageId: string, action: CopilotAction) => {
    if (!action.pendingActionId) return;
    try {
      await confirmPendingAction(action.pendingActionId);
      toast.success("Action confirmed");
      setMessages(prev => prev.map(m => m.id !== messageId ? m : {
        ...m,
        toolCalls: m.toolCalls?.map(a => a === action ? { ...a, status: "success", requiresConfirmation: false } : a),
      }));
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm action");
    }
  };

  const toggle = () => {
    setOpen(!open);
    if (!hasOpened) {
      setHasOpened(true);
      setMessages([{ id: "welcome", role: "assistant", content: "Hi, I'm Mikey. Ask me anything about your leads, tasks, or campaigns.", createdAt: new Date().toISOString() }]);
    }
  };

  return (
    <div className="copilot-widget-fab fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 [body.overlay-open_&]:hidden">
      {open && (
        <div className="w-[380px] h-[520px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden animate-scale-in origin-bottom-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--primary)] text-white">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center"><MessageCircle size={14} /></div>
              <span className="text-sm font-semibold">Mikey</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-white/20 transition-colors"><X size={15} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--primary)] text-white rounded-br-md"
                    : "bg-[var(--muted)] text-[var(--foreground)] rounded-bl-md"
                }`}>
                  {m.toolCalls?.filter(a => a.requiresConfirmation).map((a, i) => (
                    <div key={i} className="mb-2 flex items-center gap-1.5 text-xs">
                      <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                      <span className="text-[var(--muted-foreground)]">{a.tool === "bulk_send_message" ? `${a.args?.messages?.length ?? 0} messages ready to send` : a.tool}</span>
                      <button onClick={() => handleConfirm(m.id, a)}
                        className="ml-auto rounded-md bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                        Confirm
                      </button>
                    </div>
                  ))}
                  {m.role === "user" ? m.content : <MarkdownMessage content={m.content} />}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[var(--muted)] rounded-xl rounded-bl-md px-3.5 py-2.5 text-sm text-[var(--muted-foreground)] flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> Mikey is thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[var(--border)] p-3">
            <div className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask Mikey anything..."
                className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
              <button onClick={send} disabled={sending || !input.trim()}
                className="h-9 w-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={toggle}
        className={`h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open ? "bg-[var(--muted-foreground)] rotate-45" : "bg-[var(--primary)] hover:scale-105"
        } text-white`}>
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
}
