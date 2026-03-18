import { useState, useEffect, type FormEvent } from "react";
import Layout from "@/components/Layout";
import {
  getAgents,
  createAgent,
  deleteAgent,
  rotateAgentKey,
  type Agent,
} from "@/api/client";
import { Bot, Plus, Copy, RefreshCw, Trash2, Check } from "lucide-react";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKeys, setFreshKeys] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const agent = await createAgent({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setAgents((prev) => [agent, ...prev]);
      if (agent.api_key) {
        setFreshKeys((prev) => ({ ...prev, [agent.id]: agent.api_key! }));
      }
      setNewName("");
      setNewDesc("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleRotate(agentId: number) {
    setError("");
    try {
      const updated = await rotateAgentKey(agentId);
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, ...updated } : a))
      );
      if (updated.api_key) {
        setFreshKeys((prev) => ({ ...prev, [agentId]: updated.api_key! }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rotate key");
    }
  }

  async function handleDelete(agentId: number) {
    if (!confirm("Delete this agent? All associated entries will remain.")) return;
    setError("");
    try {
      await deleteAgent(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      setFreshKeys((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete agent");
    }
  }

  function copyKey(agentId: number, key: string) {
    navigator.clipboard.writeText(key);
    setCopied(agentId);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Bot className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-semibold">Agents</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Manage agents and their API keys
            </p>
          </div>
        </div>

        {/* Create form */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">New Agent</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Agent name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "Create Agent"}
            </button>
          </form>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-md px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Agent list */}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-zinc-500">No agents yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => {
              const key = freshKeys[agent.id];
              return (
                <div
                  key={agent.id}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-sm">{agent.name}</div>
                      {agent.description && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {agent.description}
                        </div>
                      )}
                      <div className="text-xs text-zinc-600 mt-1">
                        Created{" "}
                        {new Date(agent.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRotate(agent.id)}
                        title="Rotate API key"
                        className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        title="Delete agent"
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {key ? (
                    <div className="mt-4 bg-zinc-950 border border-emerald-800/50 rounded-md p-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-xs text-emerald-400 font-medium">
                          API Key — copy it now, it won't be shown again
                        </span>
                        <button
                          onClick={() => copyKey(agent.id, key)}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          {copied === agent.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied === agent.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <code className="text-xs text-zinc-300 break-all font-mono">
                        {key}
                      </code>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-zinc-600 font-mono">
                        ••••••••••••••••••••••••••••••••
                      </span>
                      <span className="text-xs text-zinc-600">
                        — rotate to get a new key
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
