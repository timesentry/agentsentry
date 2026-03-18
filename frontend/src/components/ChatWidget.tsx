import { useState, useRef, useEffect } from "react";
import {
  sendChatMessage,
  type ChatMessage,
  type ToolAction,
} from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronUp,
  Bot,
} from "lucide-react";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolActions?: ToolAction[];
}

const TOOL_LABELS: Record<string, string> = {
  get_dashboard_stats: "Pulled dashboard stats",
  get_agents: "Looked up agents",
  get_projects: "Looked up projects",
  get_entries: "Fetched entries",
  get_analytics: "Ran analytics",
  get_agent_summary: "Summarized agent",
};

function ToolActionBadge({ action }: { action: ToolAction }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[action.tool] || action.tool;

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-zinc-700"
      >
        <Wrench className="h-3 w-3" />
        {label}
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <pre className="mt-1 max-h-24 overflow-auto rounded bg-zinc-900 p-2 text-xs font-mono text-zinc-300">
          {JSON.stringify(action.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: DisplayMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages: ChatMessage[] = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await sendChatMessage(apiMessages);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
          toolActions:
            result.tool_actions.length > 0 ? result.tool_actions : undefined,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `Something went wrong: ${err.message}`
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 hover:bg-emerald-400"
        title="Chat with AgentSentry AI"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-96 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-100">AgentSentry AI</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="mb-3 h-10 w-10 text-emerald-400/40" />
            <p className="text-sm font-medium text-zinc-400">
              Ask me about your agent usage
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              I can analyze tokens, time, agents, projects, and trends.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "flex justify-end" : ""}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-600 px-3.5 py-2.5 text-sm text-white">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[90%]">
                {msg.toolActions && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {msg.toolActions.map((a, j) => (
                      <ToolActionBadge key={j} action={a} />
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-bl-md bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={loading}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
