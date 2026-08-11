"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken, getUser } from "@/lib/api";
import type { Issue } from "@civicpulse/shared-types";
import { formatDistanceToNow, format, isPast } from "date-fns";
import {
  ArrowUpCircle, ArrowDownCircle, MapPin, Clock, ShieldAlert,
  CheckCircle2, AlertTriangle, ChevronRight, Loader2,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:         { label: "Open",         color: "text-slate-700",   bg: "bg-slate-100"   },
  under_review: { label: "Under Review", color: "text-amber-700",   bg: "bg-amber-50"    },
  approved:     { label: "Approved",     color: "text-blue-700",    bg: "bg-blue-50"     },
  implemented:  { label: "Implemented",  color: "text-emerald-700", bg: "bg-emerald-50"  },
  closed:       { label: "Closed",       color: "text-rose-700",    bg: "bg-rose-50"     },
};

const STATUS_FLOW = [
  { value: "under_review", label: "Mark Under Review" },
  { value: "approved",     label: "Approve" },
  { value: "implemented",  label: "Mark Implemented" },
  { value: "closed",       label: "Close Issue" },
];

export default function IssueDetailPage() {
  const params = useParams();
  const issueId = params.id as string;
  const token = getToken();
  const user = getUser<{ role: string; _id: string }>();
  const isOfficial = user?.role === "official" || user?.role === "moderator";

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadIssue = useCallback(async () => {
    try {
      const data = await apiFetch<{ issue: Issue }>(`/issues/${issueId}`);
      setIssue(data.issue);
    } catch (err: any) {
      setError(err.message || "Failed to load issue details");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    if (!token) { setLoading(false); setError("Please sign in to view issue details."); return; }
    loadIssue();
  }, [issueId, token, loadIssue]);

  async function handleStatusChange(newStatus: string) {
    if (!issue) return;
    setUpdating(true);
    try {
      const data = await apiFetch<{ issue: Issue }>(`/issues/${issueId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setIssue(data.issue);
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading issue details...</div>;
  if (error) return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-center text-rose-600">
      <p>{error}</p>
      <Link href="/issues" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">Back to Issues</Link>
    </div>
  );
  if (!issue) return null;

  const statusCfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.open;
  const slaDate = new Date(issue.slaDeadline);
  const slaBreached = isPast(slaDate);
  const currentLocation = typeof issue.currentLocationId === "object" ? issue.currentLocationId as any : null;
  const originLocation = typeof issue.originLocationId === "object" ? issue.originLocationId as any : null;
  const escalated = issue.escalationHistory?.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/issues" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Back to Issues
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Main card */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <MapPin size={14} />
          <span>
            Origin: <strong>{originLocation?.name ?? "Unknown"}</strong>
            {escalated && currentLocation && (
              <> &rarr; Currently at: <strong>{currentLocation.name}</strong></>
            )}
          </span>
        </div>
        <div className="mb-1 text-xs text-slate-400">
          Reported {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
        </div>
        <h1 className="mb-4 text-3xl font-bold text-slate-900">{issue.title}</h1>
        <p className="mb-6 whitespace-pre-wrap text-slate-700">{issue.description}</p>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {issue.tags?.map((tag: string) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">#{tag}</span>
          ))}
        </div>
      </div>

      {/* Votes + SLA */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-emerald-600">
          <ArrowUpCircle size={20} /> {issue.votes.up} upvotes
        </div>
        <div className="flex items-center gap-2 font-semibold text-rose-500">
          <ArrowDownCircle size={20} /> {issue.votes.down} downvotes
        </div>
        <div className={`ml-auto flex items-center gap-2 text-xs font-medium ${slaBreached ? "text-rose-600" : "text-slate-500"}`}>
          <Clock size={14} />
          {slaBreached
            ? `SLA overdue — breached ${formatDistanceToNow(slaDate, { addSuffix: true })}`
            : `SLA deadline: ${format(slaDate, "dd MMM yyyy, hh:mm a")}`}
        </div>
      </div>

      {/* AI risk */}
      {issue.aiRiskFlag?.flagged && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="text-sm font-semibold text-amber-800">AI Risk Flag</div>
            <div className="text-xs text-amber-700">{issue.aiRiskFlag.reason ?? "This issue has been flagged as high-priority by AI."}</div>
          </div>
        </div>
      )}

      {/* Escalation History */}
      {escalated ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
            <ChevronRight size={16} className="text-indigo-400" /> Escalation Journey
          </h2>
          <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-slate-200">
            <div className="relative">
              <span className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-indigo-400 bg-white" />
              <div className="text-xs font-semibold text-slate-700">Reported at <span className="text-indigo-600">{originLocation?.name ?? "—"}</span></div>
              <div className="text-xs text-slate-400">{format(new Date(issue.createdAt), "dd MMM yyyy, hh:mm a")}</div>
            </div>
            {issue.escalationHistory.map((hop: any, i: number) => {
              const from = typeof hop.fromLocationId === "object" ? hop.fromLocationId : null;
              const to = typeof hop.toLocationId === "object" ? hop.toLocationId : null;
              return (
                <div key={i} className="relative">
                  <span className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-white" />
                  <div className="text-xs font-semibold text-slate-700">
                    Escalated: <span className="text-amber-600">{from?.name ?? "—"}</span> &rarr; <span className="text-amber-600">{to?.name ?? "—"}</span>
                  </div>
                  <div className="text-xs text-slate-500">{hop.reason}</div>
                  <div className="text-xs text-slate-400">{format(new Date(hop.movedAt), "dd MMM yyyy, hh:mm a")}</div>
                </div>
              );
            })}
            <div className="relative">
              <span className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 ${issue.status === "implemented" ? "border-emerald-400" : "border-slate-300"} bg-white`} />
              <div className="text-xs font-semibold text-slate-700">
                Now at <span className="text-slate-600">{currentLocation?.name ?? "—"}</span> &mdash; <span className={statusCfg.color}>{statusCfg.label}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
            <strong>How escalation works:</strong> If an issue is not resolved within the SLA window, it automatically moves up to the next administrative tier (locality &rarr; colony &rarr; municipality &rarr; city). Officials at the higher tier are notified and take ownership.
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-500 shadow-sm">
          This issue has not been escalated. Officials at <strong>{originLocation?.name ?? "your area"}</strong> are responsible for resolving it within the SLA window.
        </div>
      )}

      {/* Official action panel */}
      {isOfficial ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-indigo-900">Official Actions</h2>
          <p className="mb-4 text-xs text-indigo-700">
            Update the status of this issue to reflect the current resolution progress. Citizens can see these updates in real time.
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FLOW.map(({ value, label }) => (
              <button
                key={value}
                disabled={updating || issue.status === value}
                onClick={() => handleStatusChange(value)}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors
                  ${issue.status === value
                    ? "border-indigo-300 bg-indigo-200 text-indigo-400 cursor-default"
                    : "border-indigo-400 bg-white text-indigo-700 hover:bg-indigo-100"
                  } disabled:opacity-60`}
              >
                {updating && <Loader2 size={12} className="animate-spin" />}
                {label}
              </button>
            ))}
          </div>
          {issue.status === "implemented" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 size={14} /> This issue has been resolved.
            </div>
          )}
          {slaBreached && ["open","under_review"].includes(issue.status) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-rose-700">
              <AlertTriangle size={14} /> SLA has been breached — please take action immediately.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500 shadow-sm">
          <strong>How resolution works:</strong> Officials review, approve, and implement fixes for reported issues. You can upvote this issue on the Issues page to signal its importance and raise its priority.
        </div>
      )}
    </div>
  );
}