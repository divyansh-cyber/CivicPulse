"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUser } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { EngagementMetrics } from "@civicpulse/shared-types";
import {
  AlertCircle, TrendingUp, Users, MessageSquare, BarChart2,
  ShieldAlert, CheckCircle2, Clock, Loader2,
} from "lucide-react";

interface IssuesSummary {
  byStatus: { _id: string; count: number }[];
  escalated: number;
  slaBreached: number;
}

interface DashboardData {
  metrics: EngagementMetrics[];
  issuesSummary: IssuesSummary;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under Review",
  approved: "Approved",
  implemented: "Implemented",
  closed: "Closed",
};

export default function DashboardPage() {
  const user = getUser<{ role: string; name: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [metricsRes, summaryRes] = await Promise.all([
        apiFetch<{ metrics: EngagementMetrics[] }>("/dashboard/metrics?days=30"),
        apiFetch<IssuesSummary>("/dashboard/issues-summary"),
      ]);
      setData({ metrics: metricsRes.metrics, issuesSummary: summaryRes });
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
      <Loader2 size={20} className="animate-spin" /> Loading analytics...
    </div>
  );
  if (error) return <div className="p-8 text-center text-rose-600">{error}</div>;
  if (!data) return null;

  const { metrics, issuesSummary } = data;

  // Aggregate metrics by day across all locations
  const periodMap = new Map<string, { participation: number; slaBreaches: number; count: number }>();
  metrics.forEach((m) => {
    const e = periodMap.get(m.period) ?? { participation: 0, slaBreaches: 0, count: 0 };
    e.participation += m.participationCount;
    e.slaBreaches += m.slaBreaches;
    e.count += 1;
    periodMap.set(m.period, e);
  });
  const chartData = [...periodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([period, v]) => ({
      name: period.slice(5),
      "Citizens Active": v.participation,
      "SLA Breaches": v.slaBreaches,
    }));

  const totalParticipation = metrics.reduce((s, m) => s + m.participationCount, 0);
  const totalSlaBreaches = metrics.reduce((s, m) => s + m.slaBreaches, 0);
  const totalDiscussions = metrics.reduce((s, m) => s + m.activeDiscussions, 0);
  const totalPollVotes = metrics.reduce((s, m) => s + (m.pollVoteCount ?? 0), 0);

  const openCount = issuesSummary.byStatus.find(s => s._id === "open")?.count ?? 0;
  const implementedCount = issuesSummary.byStatus.find(s => s._id === "implemented")?.count ?? 0;
  const underReviewCount = issuesSummary.byStatus.find(s => s._id === "under_review")?.count ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Official Dashboard</h1>
          <p className="text-sm text-slate-500">
            Jurisdiction overview &mdash; analytics scoped to your area of authority
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Role explanation banner */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="text-sm font-semibold text-blue-800 mb-1">Your Responsibilities as an Official</div>
        <div className="text-xs text-blue-700 space-y-1">
          <p>&#x2022; <strong>Resolve issues</strong> — click any issue to review and update its status (Under Review &rarr; Approved &rarr; Implemented)</p>
          <p>&#x2022; <strong>Create polls</strong> — only officials can create polls to gather community opinion</p>
          <p>&#x2022; <strong>Monitor SLA breaches</strong> — issues overdue past their deadline are automatically escalated to higher tiers if unresolved</p>
          <p>&#x2022; <strong>Lock discussions</strong> — moderators can lock a discussion thread that becomes off-topic</p>
        </div>
      </div>

      {/* Urgent action items */}
      {(issuesSummary.slaBreached > 0 || issuesSummary.escalated > 0) && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {issuesSummary.slaBreached > 0 && (
            <div className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="rounded-full bg-rose-100 p-3 shrink-0"><ShieldAlert size={22} className="text-rose-600" /></div>
              <div>
                <div className="text-xs font-bold text-rose-800 uppercase tracking-wide">Urgent — SLA Overdue</div>
                <div className="text-2xl font-bold text-rose-700">{issuesSummary.slaBreached} issue{issuesSummary.slaBreached !== 1 ? "s" : ""}</div>
                <div className="text-xs text-rose-600">Past their resolution deadline — action required now</div>
              </div>
            </div>
          )}
          {issuesSummary.escalated > 0 && (
            <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="rounded-full bg-amber-100 p-3 shrink-0"><AlertCircle size={22} className="text-amber-600" /></div>
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">Escalated to You</div>
                <div className="text-2xl font-bold text-amber-700">{issuesSummary.escalated} issue{issuesSummary.escalated !== 1 ? "s" : ""}</div>
                <div className="text-xs text-amber-600">Unresolved at lower tier and escalated up to your jurisdiction</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issue pipeline */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Issue Pipeline</h2>
        <p className="mb-5 text-xs text-slate-500">Current resolution state of all issues in your jurisdiction</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Awaiting Action", value: openCount, color: "bg-slate-100 text-slate-700", icon: <Clock size={16} /> },
            { label: "Being Reviewed", value: underReviewCount, color: "bg-amber-50 text-amber-700", icon: <AlertCircle size={16} /> },
            { label: "Implemented", value: implementedCount, color: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={16} /> },
            { label: "Total Issues", value: issuesSummary.byStatus.reduce((s, x) => s + x.count, 0), color: "bg-indigo-50 text-indigo-700", icon: <TrendingUp size={16} /> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className={`rounded-xl p-4 ${color}`}>
              <div className="mb-2 flex items-center gap-1.5 opacity-70">{icon}<span className="text-xs font-medium">{label}</span></div>
              <div className="text-3xl font-bold">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: <Users size={20} className="text-indigo-400" />, label: "Citizens Participated", value: totalParticipation, sub: "Unique people who created issues or sent messages" },
          { icon: <MessageSquare size={20} className="text-blue-400" />, label: "Active Discussions", value: totalDiscussions, sub: "Open discussion threads in your area" },
          { icon: <BarChart2 size={20} className="text-amber-400" />, label: "Poll Votes Cast", value: totalPollVotes, sub: "Total votes on polls you or other officials created" },
        ].map(({ icon, label, value, sub }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-medium">{label}</span></div>
            <div className="mb-1 text-3xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* SLA summary */}
      {totalSlaBreaches > 0 && (
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 shadow-sm">
          <AlertCircle size={20} className="text-rose-500 shrink-0" />
          <div className="text-xs text-rose-700">
            <strong>{totalSlaBreaches} SLA breach{totalSlaBreaches !== 1 ? "es" : ""}</strong> recorded in the last 30 days.
            Issues unresolved past their deadline are escalated to the next administrative tier automatically.
          </div>
        </div>
      )}

      {/* 7-day chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-900">7-Day Activity</h2>
        <p className="mb-6 text-xs text-slate-500">
          Citizens active per day vs. SLA breaches — see which days need more attention
        </p>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
            No data yet — analytics update every 5 minutes.
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "12px" }}
                />
                <Line type="monotone" dataKey="Citizens Active" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="SLA Breaches" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-4 flex gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-indigo-500" /> Citizens who submitted issues or sent messages that day</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-rose-500" /> Issues that exceeded their resolution SLA that day</span>
        </div>
      </div>
    </div>
  );
}