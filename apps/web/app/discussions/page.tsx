"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getToken, getUser } from "@/lib/api";
import type { Discussion } from "@civicpulse/shared-types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { MessageSquare, Lock, Unlock, X } from "lucide-react";

export default function DiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const token = getToken();
  const user = getUser<{ locationId: string }>();

  const loadDiscussions = useCallback(async () => {
    try {
      const data = await apiFetch<{ discussions: Discussion[] }>("/discussions");
      setDiscussions(data.discussions);
    } catch (err: any) {
      setError(err.message || "Failed to load discussions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); setError("Please sign in to view discussions."); return; }
    loadDiscussions();
  }, [token, loadDiscussions]);

  async function handleCreateDiscussion(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true); setFormError("");
    try {
      await apiFetch("/discussions", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), locationId: user?.locationId }),
      });
      setNewTitle(""); setShowModal(false);
      await loadDiscussions();
    } catch (err: any) {
      setFormError(err.message || "Failed to create discussion");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading discussions...</div>;
  if (error) return <div className="p-8 text-center text-rose-600">{error}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Create Discussion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Start a Discussion</h2>
              <button onClick={() => { setShowModal(false); setFormError(""); setNewTitle(""); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateDiscussion} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Discussion Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Water supply outages in Sector 12"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(""); setNewTitle(""); }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Creating..." : "Start Discussion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Community Discussions</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 shadow-sm"
        >
          + Start Discussion
        </button>
      </div>

      <div className="space-y-4">
        {discussions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            No active discussions in your area.
          </div>
        ) : (
          discussions.map((discussion) => (
            <Link
              href={`/discussions/${discussion._id}`}
              key={discussion._id}
              className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-200 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{discussion.tier}</span>
                    {discussion.status === "locked" ? (
                      <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-600">
                        <Lock size={12} /> Locked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                        <Unlock size={12} /> Open
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-900">{discussion.title}</h3>
                  {discussion.aiSummary && (
                    <div className="mb-4 border-l-2 border-indigo-200 pl-3 text-sm italic text-slate-600">
                      {discussion.aiSummary}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex flex-col items-end text-slate-500">
                  <div className="mb-1 flex items-center gap-1.5">
                    <MessageSquare size={18} />
                    <span className="font-medium">{discussion.messageCount}</span>
                  </div>
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(discussion.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
