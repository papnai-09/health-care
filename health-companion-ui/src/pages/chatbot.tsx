import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearChatHistory, chatAssistant, getChatHistory } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
}

const intro: Message = {
  id: "intro",
  role: "ai",
  text: "Hi! I am your AI assistant. Ask me anything, and let's chat!",
};

const suggestions = ["Hello! How are you?", "Tell me a joke", "What can you do?"];

function ChatbotContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([intro]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    setMessages([intro]);
  }, [user]);

  const send = async (text: string) => {
    if (!user || !text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setTyping(true);

    try {
      const historyContext = nextMessages
        .filter((m) => m.id !== "intro")
        .map((m) => ({ role: m.role, text: m.text }));

      const response = await chatAssistant(text, historyContext);
      setMessages((current) => [...current, { id: `${Date.now()}-ai`, role: "ai", text: response.reply }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get a response.");
      setMessages((current) => [...current, { id: `${Date.now()}-error`, role: "ai", text: "I am having trouble reaching the assistant right now. Please try again in a moment." }]);
    } finally {
      setTyping(false);
    }
  };

  const clearMessages = async () => {
    try {
      await clearChatHistory();
      setMessages([intro]);
      toast.success("Chat history cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear chat.");
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card animate-fade-up">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-card px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary shadow-soft">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">MediCare AI</h1>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Your general-purpose AI assistant
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={clearMessages} aria-label="Clear chat">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-6">
          {loadingHistory && <p className="text-center text-sm text-muted-foreground">Loading chat history...</p>}
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "ai" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className={`max-w-[78%] break-words rounded-lg px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${message.role === "user" ? "bg-primary text-primary-foreground shadow-soft" : "border border-border bg-surface text-foreground"}`}>
                {message.text}
              </div>
              {message.role === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-5 py-4">
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-primary" />
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-primary" />
                <span className="typing-dot inline-block h-2 w-2 rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => send(suggestion)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-smooth hover:border-primary hover:bg-primary-soft hover:text-primary">
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-3 border-t border-border bg-background p-3 sm:p-4">
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a message..." className="h-12 flex-1 rounded-lg" />
          <Button type="submit" variant="hero" size="icon" className="h-12 w-12" disabled={!input.trim() || typing}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default function ChatbotPage() {
  return (
    <ProtectedRoute>
      <ChatbotContent />
    </ProtectedRoute>
  );
}
