import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getAnalytics, type AnalyticsResponse, type Entry } from "@/api/client";
import Layout from "@/components/Layout";
import { Clock, Coins, Activity, Zap, ChevronRight } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── Palette ───────────────────────────────────────────────────────────────────

// Cool tones for projects
const PROJECT_COLORS = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#a78bfa", // violet-400
  "#2dd4bf", // teal-400
  "#818cf8", // indigo-400
  "#67e8f9", // cyan-400
  "#86efac", // green-300
];

// Warm tones for agents
const AGENT_COLORS = [
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#facc15", // yellow-400
  "#f87171", // red-400
  "#e879f9", // fuchsia-400
  "#fdba74", // orange-300
  "#fda4af", // rose-300
];

// ── Summary card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "emerald",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-900/30",
    blue: "text-blue-400 bg-blue-900/30",
    violet: "text-violet-400 bg-violet-900/30",
    orange: "text-orange-400 bg-orange-900/30",
  };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({
  entries,
  rangeFrom,
  rangeTo,
  groupBy,
}: {
  entries: Entry[];
  rangeFrom: string;
  rangeTo: string;
  groupBy: "project" | "agent";
}) {
  const start = new Date(rangeFrom).getTime();
  const end = new Date(rangeTo).getTime();
  const span = end - start || 1;

  // Stable key lists & color helpers
  const projectKeys = useMemo(
    () => Array.from(new Set(entries.map((e) => e.project_name ?? "Unassigned"))),
    [entries]
  );
  const agentKeys = useMemo(
    () => Array.from(new Set(entries.map((e) => e.agent_name ?? `#${e.agent_id}`))),
    [entries]
  );
  const projectColor = (p: string) =>
    PROJECT_COLORS[projectKeys.indexOf(p) % PROJECT_COLORS.length];
  const agentColor = (a: string) =>
    AGENT_COLORS[agentKeys.indexOf(a) % AGENT_COLORS.length];

  // Area chart keys & colors follow the current groupBy
  const areaKeys = groupBy === "project" ? projectKeys : agentKeys;
  const areaColorFor = groupBy === "project" ? projectColor : agentColor;

  // ── Stacked area data ──
  const areaSeries = useMemo(() => {
    if (entries.length === 0) return [];
    const bucketMs = Math.max(86_400_000, span / 30);
    const numBuckets = Math.ceil(span / bucketMs);

    const zeros: Record<string, number> = {};
    for (const k of areaKeys) zeros[k] = 0;

    const series: Record<string, number>[] = [];
    const times: number[] = [];
    for (let i = 0; i <= numBuckets; i++) {
      times.push(start + i * bucketMs);
      series.push({ ...zeros });
    }

    for (const e of entries) {
      const idx = Math.min(
        Math.floor((new Date(e.start).getTime() - start) / bucketMs),
        numBuckets
      );
      const key = groupBy === "project"
        ? (e.project_name ?? "Unassigned")
        : (e.agent_name ?? `#${e.agent_id}`);
      series[idx][key] += e.tokens ?? 0;
    }

    return times.map((t, i) => ({ time: t, ...series[i] }));
  }, [entries, start, span, areaKeys, groupBy]);

  // ── Collapsible groups ──
  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = groupBy === "project"
        ? (e.project_name ?? "Unassigned")
        : (e.agent_name ?? `#${e.agent_id}`);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [entries, groupBy]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (entries.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-8">
        No sessions in this range.
      </p>
    );
  }

  // Bar color for inner items (the "other" dimension)
  const innerColor = (e: Entry) =>
    groupBy === "project"
      ? agentColor(e.agent_name ?? `#${e.agent_id}`)
      : projectColor(e.project_name ?? "Unassigned");
  const innerLabel = (e: Entry) =>
    groupBy === "project"
      ? (e.agent_name ?? `#${e.agent_id}`)
      : (e.project_name ?? "Unassigned");

  return (
    <div className="space-y-5">
      {/* Stacked area overview */}
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={areaSeries} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <XAxis
            dataKey="time"
            type="number"
            domain={[start, end]}
            tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickFormatter={(v) => formatTokens(v)}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleDateString()}
            formatter={(v: number, name: string) => [formatTokens(v) + " tokens", name]}
            contentStyle={{ backgroundColor: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: "#d4d4d8" }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          {areaKeys.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={areaColorFor(key)}
              fill={areaColorFor(key)}
              fillOpacity={0.35}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Collapsible groups with session bars */}
      <div className="space-y-1">
        {Array.from(grouped.entries()).map(([group, groupEntries]) => {
          const isOpen = expanded.has(group);
          const color = areaColorFor(group);
          return (
            <div key={group}>
              <button
                onClick={() => toggle(group)}
                className="flex items-center gap-2 w-full text-left text-xs py-1.5 hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 text-zinc-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: color + "30", color }}
                >
                  {group}
                </span>
                <span className="text-zinc-600">
                  {groupEntries.length} session{groupEntries.length !== 1 && "s"}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-1 ml-5 mt-1 mb-2">
                  {groupEntries.map((e) => {
                    const s = new Date(e.start).getTime();
                    const endMs = e.end ? new Date(e.end).getTime() : s + 60_000;
                    const left = Math.max(0, ((s - start) / span) * 100);
                    const width = Math.max(0.3, ((endMs - s) / span) * 100);
                    const barColor = innerColor(e);
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-xs">
                        <span
                          className="w-24 shrink-0 truncate text-right px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ color: barColor }}
                        >
                          {innerLabel(e)}
                        </span>
                        <div className="flex-1 relative h-5 bg-zinc-800 rounded overflow-hidden">
                          <div
                            className="absolute top-0 h-full rounded opacity-80 hover:opacity-100 transition-opacity"
                            style={{
                              left: `${left}%`,
                              width: `${Math.min(width, 100 - left)}%`,
                              backgroundColor: barColor,
                            }}
                            title={`${e.agent_name} · ${e.project_name ?? "Unassigned"} · ${e.duration ? Math.round(e.duration / 1000) + "s" : "?"}`}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-zinc-600 text-right tabular-nums">
                          {e.tokens ? formatTokens(e.tokens) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-white font-medium">{formatter(payload[0].value)}</p>
    </div>
  );
}

// ── Breakdown card (bar / pie × project / agent) ─────────────────────────────

function BreakdownCard({
  title,
  data: rows,
  formatter,
  defaultChart = "pie",
  colors = PROJECT_COLORS,
}: {
  title: string;
  data: { name: string; value: number }[];
  formatter: (v: number) => string;
  defaultChart?: "pie" | "bar";
  colors?: string[];
}) {
  const [chartType, setChartType] = useState<"pie" | "bar">(defaultChart);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        <div className="flex gap-1">
          {(["pie", "bar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                chartType === t
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "pie" ? "Pie" : "Bar"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-8">No data</p>
      ) : chartType === "bar" ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#71717a" }}
              tickFormatter={(v) => formatter(v)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              content={<ChartTooltip formatter={formatter} />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#a1a1aa", formatter }}>
              {rows.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                strokeWidth={0}
                label={({ name, percent }) => `${name.length > 10 ? name.slice(0, 10) + "…" : name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
                fill="#a1a1aa"
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [formatter(v), name]}
                contentStyle={{
                  backgroundColor: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: "#d4d4d8" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {rows.map((r, i) => (
              <span key={r.name} className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                {r.name} · {formatter(r.value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const nowUtc = new Date();
  const todayUtc = `${nowUtc.getUTCFullYear()}-${String(nowUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(nowUtc.getUTCDate()).padStart(2, "0")}`;
  const thirtyAgoUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - 30));
  const thirtyAgoStr = `${thirtyAgoUtc.getUTCFullYear()}-${String(thirtyAgoUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(thirtyAgoUtc.getUTCDate()).padStart(2, "0")}`;

  const [from, setFrom] = useState(thirtyAgoStr);
  const [to, setTo] = useState(todayUtc);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineGroupBy, setTimelineGroupBy] = useState<"project" | "agent">("project");

  const load = useCallback(() => {
    setLoading(true);
    getAnalytics({ from, to })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;

  return (
    <Layout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Agent activity, hours, and token usage
            </p>
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-300 focus:outline-none"
            />
            <span className="text-zinc-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-300 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Active now"
            value={loading ? "—" : String(summary?.active_now ?? 0)}
            color="emerald"
          />
          <StatCard
            icon={Clock}
            label="Total hours"
            value={
              loading ? "—" : formatHours(summary?.total_hours ?? 0)
            }
            sub={`${summary?.total_entries ?? 0} sessions`}
            color="blue"
          />
          <StatCard
            icon={Coins}
            label="Total tokens"
            value={loading ? "—" : formatTokens(summary?.total_tokens ?? 0)}
            color="violet"
          />
          <StatCard
            icon={Zap}
            label="Sessions"
            value={loading ? "—" : String(summary?.total_entries ?? 0)}
            color="orange"
          />
        </div>

        {/* Charts row */}
        {(() => {
          // Derive by-agent stats from timeline entries
          const timeline = data?.timeline ?? [];
          const agentHoursMap = new Map<string, number>();
          const agentTokensMap = new Map<string, number>();
          for (const e of timeline) {
            const name = e.agent_name ?? `#${e.agent_id}`;
            agentHoursMap.set(name, (agentHoursMap.get(name) ?? 0) + (e.duration ?? 0) / 3_600_000);
            agentTokensMap.set(name, (agentTokensMap.get(name) ?? 0) + (e.tokens ?? 0));
          }
          const hoursByAgent = Array.from(agentHoursMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
          const tokensByAgent = Array.from(agentTokensMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
          const hoursByProject = (data?.hours_by_project ?? []).map((p) => ({
            name: p.project_name,
            value: p.hours ?? 0,
          }));
          const tokensByProject = (data?.tokens_by_project ?? []).map((p) => ({
            name: p.project_name,
            value: p.tokens ?? 0,
          }));

          return (
            <div className="grid grid-cols-4 gap-6">
              <BreakdownCard
                title="Hours by Project"
                data={hoursByProject}
                formatter={(v) => formatHours(v)}
                defaultChart="pie"
              />
              <BreakdownCard
                title="Hours by Agent"
                data={hoursByAgent}
                formatter={(v) => formatHours(v)}
                defaultChart="pie"
                colors={AGENT_COLORS}
              />
              <BreakdownCard
                title="Tokens by Project"
                data={tokensByProject}
                formatter={(v) => formatTokens(v)}
                defaultChart="bar"
              />
              <BreakdownCard
                title="Tokens by Agent"
                data={tokensByAgent}
                formatter={(v) => formatTokens(v)}
                defaultChart="bar"
                colors={AGENT_COLORS}
              />
            </div>
          );
        })()}

        {/* Timeline */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-zinc-300">
              Session Timeline
            </h2>
            <div className="flex gap-1">
              {(["project", "agent"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setTimelineGroupBy(g)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    timelineGroupBy === g
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {g === "project" ? "Project" : "Agent"}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="text-zinc-600 text-sm text-center py-8">
              Loading…
            </p>
          ) : (
            <Timeline
              entries={data?.timeline ?? []}
              groupBy={timelineGroupBy}
              rangeFrom={data?.range.from ?? from}
              rangeTo={data?.range.to ?? to}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
