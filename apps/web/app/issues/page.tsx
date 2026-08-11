"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import type { Issue } from "@civicpulse/shared-types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = getToken();

  const loadIssues = useCallback(async () => {
    try {
      const data = await apiFetch<{ issues: Issue[] }>("/issues");
      setIssues(data.issues);
    } catch (err: any) {
      setError((err as Error).message || "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleVote(issueId: string, direction: "up" | "down") {
    try {
      await apiFetch(`/issues/${issueId}/vote`, {
        method: "POST",
        body: JSON.stringify({ direction }),
      });
      await loadIssues();
    } catch (err: any) {
      alert((err as Error).message || "Failed to vote");
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Please sign in to view issues.");
      return;
    }
    loadIssues();
  }, [token, loadIssues]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading issues...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-rose-600">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Issues</h1>
        <Link href="/issues/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 shadow-sm">
          + Report Issue
        </Link>
      </div>

      <div className="space-y-6">
        {issues.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            No issues found in your locality.
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue._id} className="rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-indigo-200 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {issue.status.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{issue.title}</h3>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <button onClick={() => handleVote(issue._id, "up")} className="text-slate-400 hover:text-indigo-600">▲</button>
                  <span className="my-1 font-mono text-sm font-bold">{issue.votes?.up || 0}</span>
                  <button onClick={() => handleVote(issue._id, "down")} className="text-slate-400 hover:text-rose-600">▼</button>
                </div>
              </div>

              <p className="mb-6 line-clamp-2 text-slate-600">{issue.description}</p>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <div className="flex gap-2">
                  {issue.tags?.map((tag) => (
                    <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      #{tag}
                    </span>
                  ))}
                </div>
                <Link href={`/issues/${issue._id}`} className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500">
                  View Details →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}