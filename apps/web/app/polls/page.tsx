"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getToken, getUser } from "@/lib/api";
import type { Poll } from "@civicpulse/shared-types";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Lock, X, Loader2 } from "lucide-react";

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const token = getToken();
  const user = getUser<{ role: string; locationId: string }>();
  const isOfficial = user?.role === "official" || user?.role === "moderator";

  // Create poll modal state (officials only)
  const [showCreate, setShowCreate] = useState(false);
  const [createQuestion, setCreateQuestion] = useState("");
  const [createOptions, setCreateOptions] = useState(["", ""]);
  const [createClosesAt, setCreateClosesAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadPolls = useCallback(async () => {
    try {
      const data = await apiFetch<{ polls: Poll[] }>("/polls");
      setPolls(data.polls);
    } catch (err: any) {
      setError(err.message || "Failed to load polls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); setError("Please sign in to view polls."); return; }
    loadPolls();
  }, [token, loadPolls]);

  async function handleVote(pollId: string, option: string) {
    setVotingId(pollId);
    try {
      await apiFetch(`/polls/${pollId}/vote`, {
        method: "POST",
        body: JSON.stringify({ option }),
      });
      await loadPolls();
    } catch (err: any) {
      alert(err.message || "Failed to submit vote");
    } finally {
      setVotingId(null);
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    const validOptions = createOptions.filter(o => o.trim());
    if (validOptions.length < 2) { setCreateError("At least 2 options are required."); return; }
    if (!createQuestion.trim()) { setCreateError("Question is required."); return; }
    if (!createClosesAt) { setCreateError("Closing date is required."); return; }
    setCreating(true); setCreateError("");
    try {
      await apiFetch("/polls", {
        method: "POST",
        body: JSON.stringify({
          question: createQuestion.trim(),
          options: validOptions,
          locationId: user?.locationId,
          closesAt: new Date(createClosesAt).toISOString(),
        }),
      });
      setShowCreate(false); setCreateQuestion(""); setCreateOptions(["", ""]); setCreateClosesAt("");
      await loadPolls();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create poll");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading polls...</div>;
  if (error) return <div className="p-8 text-center text-rose-600">{error}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">

      {/* Create Poll Modal — officials only */}
      {showCreate && isOfficial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Create Poll</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              {createError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Question</label>
                <input
                  type="text" value={createQuestion} onChange={e => setCreateQuestion(e.target.value)} required
                  placeholder="e.g. Should the park closing time be extended?"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Options</label>
                <div className="space-y-2">
                  {createOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text" value={opt} onChange={e => { const o = [...createOptions]; o[i] = e.target.value; setCreateOptions(o); }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {createOptions.length > 2 && (
                        <button type="button" onClick={() => setCreateOptions(createOptions.filter((_, j) => j !== i))} className="rounded-lg px-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
                {createOptions.length < 6 && (
                  <button type="button" onClick={() => setCreateOptions([...createOptions, ""])} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-500">+ Add option</button>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Closes At</label>
                <input
                  type="datetime-local" value={createClosesAt} onChange={e => setCreateClosesAt(e.target.value)} required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? "Creating..." : "Create Poll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Local Community Polls</h1>
          <p className="text-sm text-slate-500">Vote on issues that affect your neighbourhood</p>
        </div>
        {isOfficial ? (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 shadow-sm"
          >
            + Create Poll
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <Lock size={13} /> Only officials can create polls
          </div>
        )}
      </div>

      {/* Context banner for citizens */}
      {!isOfficial && (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-xs text-blue-700">
          <strong>How polls work:</strong> Local officials create polls to gather community opinion on neighbourhood decisions. Select your preferred option to cast your vote — each citizen gets one vote per poll.
        </div>
      )}

      {/* Polls grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {polls.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            No active polls in your area.
            {isOfficial && <p className="mt-2 text-xs">Create the first poll using the button above.</p>}
          </div>
        ) : (
          polls.map((poll) => {
            const totalVotes = poll.totalVotes || 0;
            const hasVoted = poll.userVote != null;
            const isVoting = votingId === poll._id;

            return (
              <div key={poll._id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  {/* Status + closing time */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${poll.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {poll.status === "active" ? "ACTIVE" : "CLOSED"}
                    </span>
                    <span className="text-xs text-slate-400">
                      Closes {formatDistanceToNow(new Date(poll.closesAt), { addSuffix: true })}
                    </span>
                  </div>

                  <h3 className="mb-4 text-lg font-semibold text-slate-900">{poll.question}</h3>

                  <div className="space-y-2 mb-5">
                    {poll.options.map((option: string, idx: number) => {
                      const optionVotes = poll.voteCounts?.[option] || 0;
                      const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                      const isSelected = poll.userVote === option;

                      return (
                        <div key={idx} className="relative">
                          <button
                            onClick={() => !hasVoted && poll.status === "active" && handleVote(poll._id, option)}
                            disabled={hasVoted || poll.status === "closed" || isVoting}
                            className={`relative z-10 w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-all
                              ${isSelected ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                              : hasVoted || poll.status === "closed" ? "cursor-default border-slate-200 bg-white text-slate-600"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer"}
                              disabled:opacity-70`}
                          >
                            <span className="flex items-center gap-2 font-medium">
                              {isSelected && <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />}
                              {option}
                            </span>
                            {hasVoted && (
                              <span className={`text-sm font-bold ${isSelected ? "text-indigo-700" : "text-slate-400"}`}>{percentage}%</span>
                            )}
                            {isVoting && !hasVoted && <Loader2 size={14} className="animate-spin text-indigo-400" />}
                          </button>
                          {/* Progress bar */}
                          {hasVoted && (
                            <div
                              className="absolute left-0 top-0 h-full rounded-lg transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: isSelected ? "#e0e7ff" : "#f1f5f9", zIndex: 0 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast</span>
                  {hasVoted && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Your vote is recorded</span>}
                  {!hasVoted && poll.status === "active" && <span className="text-indigo-500">Tap an option to vote</span>}
                  {poll.status === "closed" && <span className="text-slate-400">Poll closed</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}