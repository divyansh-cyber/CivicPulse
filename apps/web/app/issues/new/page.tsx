"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";

export default function NewIssuePage() {
  const router = useRouter();
  const token = getToken();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center text-rose-600">
        Please sign in to report an issue.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiFetch("/issues", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      router.push("/issues");
    } catch (err: any) {
      setError(err.message || "Failed to create issue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Report an Issue</h1>
        <Link href="/issues" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Back to Issues
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sanitation, road, water" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900" />
        </div>
        <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
          {loading ? "Submitting..." : "Submit Issue"}
        </button>
      </form>
    </div>
  );
}