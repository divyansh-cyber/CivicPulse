"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken, getUser } from "@/lib/api";
import type { Discussion, Message } from "@civicpulse/shared-types";
import { formatDistanceToNow } from "date-fns";
import { Send, ShieldAlert, Bot, Lock, Unlock, Loader2 } from "lucide-react";
import io, { Socket } from "socket.io-client";

export default function DiscussionThreadPage() {
  const params = useParams();
  const discussionId = params.id as string;
  const token = getToken();
  const user = getUser<{ _id: string; role: string }>();
  const isOfficial = user?.role === "official" || user?.role === "moderator";

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locking, setLocking] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = getUser<{ _id: string }>();

  const loadThread = useCallback(async () => {
    try {
      const res = await apiFetch<{ discussion: Discussion; messages: Message[] }>(`/discussions/${discussionId}`);
      setDiscussion(res.discussion);
      setMessages(res.messages);
    } catch (err: any) {
      setError(err.message || "Failed to load thread");
    } finally {
      setLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    if (!token) { setLoading(false); setError("Please sign in to view discussion details."); return; }
    loadThread();
  }, [discussionId, token, loadThread]);

  // Socket.io — real-time messages and status changes
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const tok = getToken();
    if (!tok) return;

    const socket = io(SOCKET_URL, { auth: { token: tok }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:discussion", discussionId);
    });

    socket.on("new_message", (msg: Message) => {
      setMessages((prev) => {
        const isDuplicate = prev.some((m) => m._id === msg._id);
        const withoutTemp = prev.filter((m) => !m._id.startsWith("temp-"));
        return isDuplicate ? prev : [...withoutTemp, msg];
      });
    });

    socket.on("message_moderated", (updatedMsg: Message) => {
      setMessages((prev) => {
        if (updatedMsg.moderationStatus === "hidden") {
          return prev.filter((m) => m._id !== updatedMsg._id);
        }
        // Update the message so aiFlag properties and toxic badges appear
        return prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m));
      });
    });

    // Listen for lock/unlock broadcast
    socket.on("discussion_status_changed", ({ status }: { discussionId: string; status: string }) => {
      setDiscussion((prev) => prev ? { ...prev, status: status as any } : prev);
    });

    return () => { socket.disconnect(); };
  }, [discussionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || discussion?.status === "locked") return;

    const content = newMessage.trim();
    setNewMessage("");

    // Optimistic update
    const optimisticMsg: Message = {
      _id: `temp-${Date.now()}`,
      discussionId,
      authorId: currentUser as any,
      content,
      aiFlag: { toxic: false, offTopic: false, score: 0, sentiment: 0, checkedAt: null },
      moderationStatus: "visible",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await apiFetch(`/discussions/${discussionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticMsg._id));
      setNewMessage(content);
      alert(err.message || "Failed to send message");
    }
  }

  async function handleToggleLock() {
    if (!discussion) return;
    setLocking(true);
    try {
      const res = await apiFetch<{ discussion: { _id: string; status: string } }>(
        `/discussions/${discussionId}/lock`,
        { method: "PATCH" }
      );
      setDiscussion((prev) => prev ? { ...prev, status: res.discussion.status as any } : prev);
    } catch (err: any) {
      alert(err.message || "Failed to update discussion status");
    } finally {
      setLocking(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading thread...</div>;
  if (error) return <div className="p-8 text-center text-rose-600">{error}</div>;
  if (!discussion) return null;

  const isLocked = discussion.status === "locked";

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-4xl flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-4 border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              {isLocked && (
                <span className="flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  <Lock size={11} /> Locked
                </span>
              )}
              <h1 className="text-2xl font-bold text-slate-900">{discussion.title}</h1>
            </div>
            {isLocked && (
              <p className="text-xs text-rose-600 mt-1">
                This discussion has been locked by an official. New messages are not allowed.
              </p>
            )}
          </div>
          {/* Official lock/unlock button */}
          {isOfficial && (
            <button
              onClick={handleToggleLock}
              disabled={locking}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isLocked
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
              } disabled:opacity-50`}
              title={isLocked ? "Unlock this discussion" : "Lock this discussion (off-topic)"}
            >
              {locking
                ? <Loader2 size={12} className="animate-spin" />
                : isLocked ? <Unlock size={12} /> : <Lock size={12} />}
              {isLocked ? "Unlock" : "Lock Thread"}
            </button>
          )}
        </div>

        {discussion.aiSummary && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-700">
            <Bot size={18} className="mt-0.5 shrink-0" />
            <p><span className="font-semibold text-indigo-700">AI Digest:</span> {discussion.aiSummary}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
        {messages.length === 0 ? (
          <div className="mt-10 text-center text-slate-500">
            No messages yet. {!isLocked && "Start the conversation!"}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUser?._id === (typeof msg.authorId === "string" ? msg.authorId : (msg.authorId as any)?._id);
            const authorName = typeof msg.authorId === "object" ? (msg.authorId as any).name : "Unknown User";
            const isToxic = msg.aiFlag?.toxic;
            const isTemp = msg._id.startsWith("temp-");

            if (msg.moderationStatus === "hidden") return null;

            return (
              <div key={msg._id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${isTemp ? "opacity-60" : ""}`}>
                <span className="mb-1 ml-1 mr-1 text-xs text-slate-500">
                  {!isMe && <span className="font-medium text-slate-600">{authorName} &bull; </span>}
                  {isTemp ? "Sending..." : `${formatDistanceToNow(new Date(msg.createdAt))} ago`}
                </span>
                <div className={`relative max-w-[80%] rounded-2xl px-4 py-2 ${
                  isMe ? "rounded-tr-sm bg-indigo-600 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-900 shadow-sm"
                }`}>
                  {isToxic && (
                    <div className="absolute -top-2 -right-2 rounded-full bg-rose-500 p-1 text-white shadow-lg" title="Flagged as potentially toxic">
                      <ShieldAlert size={12} />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 pt-4">
        {isLocked ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-4 text-sm text-rose-700">
            <Lock size={15} /> This discussion is locked. No new messages can be posted.
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="flex items-center justify-center rounded-xl bg-indigo-600 p-3 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
            >
              <Send size={20} />
            </button>
          </form>
        )}
        <p className="mt-2 text-center text-xs text-slate-500">
          Messages are actively moderated by AI for toxicity and community guidelines.
        </p>
      </div>
    </div>
  );
}