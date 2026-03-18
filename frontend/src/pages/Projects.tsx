import { useState, useEffect, type FormEvent } from "react";
import Layout from "@/components/Layout";
import {
  getProjects,
  createProject,
  deleteProject,
  getProject,
  updateProject,
  getAgents,
  type Project,
  type Agent,
} from "@/api/client";
import { FolderOpen, Plus, Trash2, ChevronDown, ChevronRight, Check } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [projectAgents, setProjectAgents] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getProjects(), getAgents()])
      .then(([p, a]) => {
        setProjects(p);
        setAgents(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const project = await createProject({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      setNewName("");
      setNewDesc("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(projectId: number) {
    if (!confirm("Delete this project? Entries will remain but become unassigned.")) return;
    setError("");
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (expanded === projectId) setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  }

  async function handleExpand(projectId: number) {
    if (expanded === projectId) {
      setExpanded(null);
      return;
    }
    setExpanded(projectId);
    if (!(projectId in projectAgents)) {
      try {
        const detail = await getProject(projectId);
        setProjectAgents((prev) => ({
          ...prev,
          [projectId]: (detail.agents ?? []).map((a) => a.id),
        }));
      } catch {
        setProjectAgents((prev) => ({ ...prev, [projectId]: [] }));
      }
    }
  }

  function toggleAgent(projectId: number, agentId: number) {
    setProjectAgents((prev) => {
      const current = prev[projectId] ?? [];
      return {
        ...prev,
        [projectId]: current.includes(agentId)
          ? current.filter((id) => id !== agentId)
          : [...current, agentId],
      };
    });
  }

  async function handleSaveAgents(projectId: number) {
    setSaving(projectId);
    setError("");
    try {
      const updated = await updateProject(projectId, {
        agent_ids: projectAgents[projectId] ?? [],
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, agent_count: updated.agent_count } : p))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save agents");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <FolderOpen className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Group agents into projects for analytics
            </p>
          </div>
        </div>

        {/* Create form */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">New Project</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Project name"
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
              {creating ? "Creating…" : "Create Project"}
            </button>
          </form>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-md px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Project list */}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-zinc-500">No projects yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const isExpanded = expanded === project.id;
              const selectedAgents = projectAgents[project.id];

              return (
                <div
                  key={project.id}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {project.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-zinc-500">
                          {project.agent_count} agent{project.agent_count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {new Date(project.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleExpand(project.id)}
                        title="Manage agents"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Agents
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        title="Delete project"
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-5 py-4">
                      {agents.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          No agents yet.{" "}
                          <a href="/agents" className="text-emerald-400 hover:underline">
                            Create one first.
                          </a>
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-zinc-400 mb-3">
                            Select agents to assign to this project:
                          </p>
                          <div className="space-y-2 mb-4">
                            {agents.map((agent) => {
                              const checked = selectedAgents?.includes(agent.id) ?? false;
                              return (
                                <label
                                  key={agent.id}
                                  className="flex items-center gap-3 cursor-pointer group"
                                >
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                      checked
                                        ? "bg-emerald-600 border-emerald-600"
                                        : "border-zinc-600 group-hover:border-zinc-400"
                                    }`}
                                    onClick={() => toggleAgent(project.id, agent.id)}
                                  >
                                    {checked && <Check className="h-2.5 w-2.5 text-white" />}
                                  </div>
                                  <span
                                    className="text-sm text-zinc-300 group-hover:text-white transition-colors"
                                    onClick={() => toggleAgent(project.id, agent.id)}
                                  >
                                    {agent.name}
                                  </span>
                                  {agent.description && (
                                    <span className="text-xs text-zinc-600">
                                      {agent.description}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => handleSaveAgents(project.id)}
                            disabled={saving === project.id || selectedAgents === undefined}
                            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                          >
                            {saving === project.id ? "Saving…" : "Save"}
                          </button>
                        </>
                      )}
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
