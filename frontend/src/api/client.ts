export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Entry {
  id: number;
  session_id: string;
  start: string;
  end: string | null;
  duration: number | null;
  tokens: number | null;
  description: string | null;
  agent_id: number;
  agent_name: string | null;
  project_id: number | null;
  project_name: string | null;
  created_at: string;
}

export interface Agent {
  id: number;
  name: string;
  description: string | null;
  api_key?: string;
  created_at: string;
}

export interface ProjectStat {
  project_id: number | null;
  project_name: string;
  hours?: number;
  tokens?: number;
}

export interface AnalyticsResponse {
  timeline: Entry[];
  hours_by_project: ProjectStat[];
  tokens_by_project: ProjectStat[];
  summary: {
    total_entries: number;
    total_hours: number;
    total_tokens: number;
    active_now: number;
  };
  range: { from: string; to: string };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data as T;
}

export function login(email: string, password: string) {
  return request<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ message: string }>("/auth/logout", { method: "POST" });
}

export function getMe() {
  return request<User>("/auth/me");
}

export function getEntries(params?: {
  agent_id?: number;
  project_id?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.agent_id) qs.set("agent_id", String(params.agent_id));
  if (params?.project_id) qs.set("project_id", String(params.project_id));
  if (params?.limit) qs.set("limit", String(params.limit));
  return request<Entry[]>(`/entries/?${qs}`);
}

export function getAnalytics(params?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  return request<AnalyticsResponse>(`/analytics/?${qs}`);
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  agent_count: number;
  created_at: string;
  agents?: Agent[];
}

export function getProjects() {
  return request<Project[]>("/projects/");
}

export function createProject(data: { name: string; description?: string; agent_ids?: number[] }) {
  return request<Project>("/projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getProject(projectId: number) {
  return request<Project>(`/projects/${projectId}`);
}

export function updateProject(projectId: number, data: { name?: string; description?: string; agent_ids?: number[] }) {
  return request<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProject(projectId: number) {
  return request<{ message: string }>(`/projects/${projectId}`, { method: "DELETE" });
}

export function getEntryTranscript(entryId: number) {
  return request<{ transcript: unknown[] | null }>(`/entries/${entryId}/transcript`);
}

export function getAgents() {
  return request<Agent[]>("/agents/");
}

export function createAgent(data: { name: string; description?: string }) {
  return request<Agent>("/agents/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteAgent(agentId: number) {
  return request<{ message: string }>(`/agents/${agentId}`, { method: "DELETE" });
}

export function rotateAgentKey(agentId: number) {
  return request<Agent>(`/agents/${agentId}/rotate-key`, { method: "POST" });
}

// ── Chat ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolAction {
  tool: string;
  input: Record<string, unknown>;
  result_preview: string;
}

export interface ChatResponse {
  response: string;
  tool_actions: ToolAction[];
}

export function sendChatMessage(messages: ChatMessage[]) {
  return request<ChatResponse>("/chat/message", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
