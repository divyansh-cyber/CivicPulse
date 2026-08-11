"use client";
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  User, MapPin, Building2, Shield, ChevronRight,
  Users, BarChart2, Loader2, Mail, BadgeCheck,
} from "lucide-react";

interface LocationNode {
  _id: string; name: string; tier: string;
  official?: { name: string; email: string; scopeTier: string } | null;
}
interface ProfileData {
  _id: string; name: string; email: string;
  role: string; scopeTier: string;
  location: LocationNode;
  ancestors: LocationNode[];
  jurisdictionTree: LocationNode[] | null;
}

const TIER_ORDER = ["city", "municipality", "colony", "locality"];
const TIER_COLORS: Record<string, string> = {
  city:         "bg-indigo-100 text-indigo-800 border-indigo-200",
  municipality: "bg-blue-100 text-blue-800 border-blue-200",
  colony:       "bg-emerald-100 text-emerald-800 border-emerald-200",
  locality:     "bg-amber-100 text-amber-800 border-amber-200",
};
const TIER_DOT: Record<string, string> = {
  city: "bg-indigo-500", municipality: "bg-blue-500",
  colony: "bg-emerald-500", locality: "bg-amber-500",
};
const ROLE_CONFIG: Record<string, { label: string; color: string; icon: JSX.Element; description: string }> = {
  citizen:   { label: "Citizen",   color: "bg-slate-100 text-slate-700",   icon: <User size={15} />,     description: "Submit issues, vote on polls, and participate in discussions in your locality." },
  official:  { label: "Official",  color: "bg-indigo-100 text-indigo-700", icon: <Shield size={15} />,   description: "Manage issues, create polls, lock discussions, and monitor your jurisdiction." },
  moderator: { label: "Moderator", color: "bg-rose-100 text-rose-700",     icon: <BadgeCheck size={15} />, description: "City-wide moderation — review flagged messages and oversee all discussion threads." },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }

    apiFetch<{ user: ProfileData }>("/auth/me")
      .then((res) => setProfile(res.user))
      .catch((err) => setError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
      <Loader2 size={20} className="animate-spin" /> Loading profile...
    </div>
  );
  if (error) return <div className="p-8 text-center text-rose-600">{error}</div>;
  if (!profile) return null;

  const roleCfg = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.citizen;

  // Build hierarchy breadcrumb: ancestors + own location (sorted city→locality)
  const hierarchy = [
    ...profile.ancestors.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)),
    profile.location,
  ].filter(Boolean);

  // Group jurisdiction by tier
  const byTier: Record<string, LocationNode[]> = {};
  (profile.jurisdictionTree ?? []).forEach((loc) => {
    if (!byTier[loc.tier]) byTier[loc.tier] = [];
    byTier[loc.tier].push(loc);
  });
  const tiersPresent = TIER_ORDER.filter((t) => byTier[t]?.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">My Profile</h1>

      {/* Identity card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-br from-indigo-500 to-indigo-700" />
        <div className="px-8 pb-8 pt-0">
          <div className="-mt-10 mb-5 flex items-end justify-between">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-indigo-100 text-3xl font-bold text-indigo-700 shadow-md">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${roleCfg.color}`}>
              {roleCfg.icon} {roleCfg.label}
            </span>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-slate-900">{profile.name}</h2>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <Mail size={14} /> {profile.email}
          </div>
          <p className="text-sm text-slate-600">{roleCfg.description}</p>
        </div>
      </div>

      {/* Location hierarchy */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <MapPin size={18} className="text-indigo-500" /> Your Location
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Your full administrative address from city level down to your locality:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hierarchy.map((loc, i) => (
            <div key={loc._id} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${TIER_COLORS[loc.tier] ?? "bg-slate-100 text-slate-700"}`}>
                <span className={`h-2 w-2 rounded-full ${TIER_DOT[loc.tier] ?? "bg-slate-400"}`} />
                <span className="capitalize text-[10px] opacity-70">{loc.tier}</span>
                <span className="font-semibold">{loc.name}</span>
              </div>
              {i < hierarchy.length - 1 && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Jurisdiction tree — officials and moderators only */}
      {profile.jurisdictionTree && tiersPresent.length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Building2 size={18} className="text-indigo-500" /> Your Jurisdiction
          </h2>
          <p className="mb-5 text-xs text-slate-500">
            All locations under your authority — and which official manages each one:
          </p>
          <div className="space-y-6">
            {tiersPresent.map((tier) => (
              <div key={tier}>
                <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${TIER_COLORS[tier]}`}>
                  <span className={`h-2 w-2 rounded-full ${TIER_DOT[tier]}`} />
                  {tier.charAt(0).toUpperCase() + tier.slice(1)} level
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {byTier[tier].map((loc) => (
                    <div key={loc._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 font-semibold text-slate-800">{loc.name}</div>
                      {loc.official ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 shrink-0">
                            {loc.official.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-700">{loc.official.name}</div>
                            <div className="text-xs text-slate-400">{loc.official.email}</div>
                          </div>
                          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[loc.official.scopeTier] ?? "bg-slate-100"}`}>
                            {loc.official.scopeTier}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users size={12} /> No official assigned
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Citizen: what you can do */}
      {profile.role === "citizen" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <BarChart2 size={18} className="text-indigo-500" /> What You Can Do
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: "📋", title: "Report Issues", desc: "Submit civic issues in your locality — they get assigned to your colony official for resolution." },
              { icon: "🗳️", title: "Vote on Polls", desc: "Cast votes on polls created by local officials about neighbourhood priorities." },
              { icon: "💬", title: "Join Discussions", desc: "Participate in community discussions about local topics started in your area." },
              { icon: "⬆️", title: "Upvote Issues", desc: "Upvote issues you care about to signal priority to your colony official." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <div className="mb-1 text-sm font-semibold text-slate-800">{title}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}