"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, saveAuth } from "@/lib/api";
import Link from "next/link";
import type { Location } from "@civicpulse/shared-types";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [locationId, setLocationId] = useState("");
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load locations for the dropdown
  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await apiFetch<{ tree?: Location[]; locations?: Location[] }>("/locations/tree", { auth: false });
        const all: Location[] = [];
        const traverse = (node: any) => {
          if (node.tier === "locality") all.push(node);
          if (node.children) node.children.forEach(traverse);
        };
        (res.tree ?? res.locations ?? []).forEach(traverse);
        setLocations(all);
        if (all.length > 0) setLocationId(all[0]._id);
      } catch (err) {
        console.error("Failed to load locations", err);
        setError("Failed to load locations. Please try again.");
      }
    }
    fetchLocations();
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch<{ token: string; user: object }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, locationId }),
        auth: false,
      });

      saveAuth(res.token, res.user);
      router.push("/feed");
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Join CivicPulse
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">Full Name</label>
              <input
                id="name" name="name" type="text" required
                value={name} onChange={(e) => setName(e.target.value)}
                className="relative block w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email-address">Email address</label>
              <input
                id="email-address" name="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
              <input
                id="password" name="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="location">Your Neighborhood</label>
              <select
                id="location" name="location" required
                value={locationId} onChange={(e) => setLocationId(e.target.value)}
                className="relative block w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6 appearance-none"
              >
                <option value="" disabled>Select your neighborhood...</option>
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.name}</option>
                ))}
              </select>
              {locations.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">No localities found. Make sure the API is seeded and running.</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit" disabled={loading}
              className="flex w-full justify-center rounded-lg bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
