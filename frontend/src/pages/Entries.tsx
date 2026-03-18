import { useEffect, useState } from "react";
import { getEntries, getEntryTranscript, type Entry } from "@/api/client";
import Layout from "@/components/Layout";
import { Clock, Coins, ChevronDown, ChevronRight, FileText, X } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTokens(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Transcript types ──────────────────────────────────────────────────

interface TranscriptMessage {
  type?: string;
  role?: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: Array<{ type: string; text?: string; name?: string; input?: unknown; content?: unknown }> | string;
  };
  [key: string]: unknown;
}

// ── Transcript modal ──────────────────────────────────────────────────

function renderContent(content: TranscriptMessage["message"]["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((block) => {
      if (block.type === "text") return block.text ?? "";
      if (block.type === "tool_use") return `[tool: ${block.name}]`;
      if (block.type === "tool_result") return `[tool result]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function TranscriptModal({
  entryId,
  onClose,
}: {
  entryId: number;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<TranscriptMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntryTranscript(entryId)
      .then((r) => setLines((r.transcript as TranscriptMessage[]) ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entryId]);

  const messages = (lines ?? []).filter(
    (l) => l.type === "user" || l.type === "assistant"
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <span className="font-medium text-sm">Transcript</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading && (
            <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center py-8">{error}</p>
          )}
          {!loading && !error && messages.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">
              No transcript available for this session.
            </p>
          )}
          {messages.map((msg, i) => {
            const role = msg.message?.role ?? msg.type ?? "unknown";
            const text = renderContent(msg.message?.content);
            if (!text) return null;
            const isUser = role === "user";
            return (
              <div key={i} className={`flex gap-3 ${isUser ? "" : "flex-row-reverse"}`}>
                <div
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                    isUser
                      ? "bg-zinc-700 text-zinc-300"
                      : "bg-emerald-900 text-emerald-300"
                  }`}
                >
                  {isUser ? "U" : "A"}
                </div>
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words ${
                    isUser
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-zinc-800/60 text-zinc-300 border border-zinc-700"
                  }`}
                >
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <>
      <tr
        className="border-b border-zinc-800 hover:bg-zinc-800/40 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3 text-zinc-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">
          {formatDate(entry.start)}
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="font-medium text-white">
            {entry.agent_name ?? `Agent #${entry.agent_id}`}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {entry.project_name ? (
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-800">
              {entry.project_name}
            </span>
          ) : (
            <span className="text-zinc-600 text-xs">Unassigned</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-300 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          {formatDuration(entry.duration)}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-300">
          <span className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-zinc-500" />
            {formatTokens(entry.tokens)}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-zinc-500 max-w-xs truncate">
          {entry.description ?? (
            <span className="italic text-zinc-600">No description</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-600 font-mono">
          {entry.session_id?.slice(0, 12)}…
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); setShowTranscript(true); }}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
            title="View Transcript"
          >
            <FileText className="h-4 w-4" />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-zinc-900/60 border-b border-zinc-800">
          <td colSpan={9} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-6 text-sm mb-3">
              <div>
                <span className="text-zinc-500">Start</span>
                <p className="text-zinc-200 font-mono text-xs mt-0.5">
                  {entry.start}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">End</span>
                <p className="text-zinc-200 font-mono text-xs mt-0.5">
                  {entry.end ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Session ID</span>
                <p className="text-zinc-200 font-mono text-xs mt-0.5 break-all">
                  {entry.session_id}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Entry ID</span>
                <p className="text-zinc-200 font-mono text-xs mt-0.5">
                  #{entry.id}
                </p>
              </div>
            </div>
            {entry.description && (
              <div className="mb-3">
                <span className="text-zinc-500 text-sm">Description</span>
                <p className="text-zinc-200 text-sm mt-0.5">
                  {entry.description}
                </p>
              </div>
            )}
          </td>
        </tr>
      )}
      {showTranscript && (
        <TranscriptModal entryId={entry.id} onClose={() => setShowTranscript(false)} />
      )}
    </>
  );
}

export default function Entries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    setLoading(true);
    getEntries({ limit })
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Time Entries</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {loading ? "Loading…" : `${entries.length} entries`}
            </p>
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-zinc-600"
                  >
                    Loading…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-zinc-600"
                  >
                    No entries yet. Start a Claude Code session with the
                    AgentSentry plugin configured.
                  </td>
                </tr>
              ) : (
                entries.map((e) => <EntryRow key={e.id} entry={e} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
