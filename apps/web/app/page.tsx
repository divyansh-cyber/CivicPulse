import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-0 h-[600px] w-[600px] rounded-full bg-indigo-300/25 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-sky-300/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/20 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              Community-First Democracy
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Your Voice.{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                Your Neighbourhood.
              </span>
            </h1>

            <p className="mb-10 max-w-xl text-xl leading-relaxed text-slate-600">
              Submit civic issues, vote on local priorities, join discussions, and
              hold officials accountable — with AI-moderated transparency and
              automated SLA escalation.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/auth/register"
                className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
              >
                Get Started →
              </Link>
              <Link
                href="/issues"
                className="rounded-xl border border-slate-200 px-8 py-3.5 text-lg font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-white hover:text-slate-900"
              >
                Browse Issues
              </Link>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-6 mt-14">
              {[
                { icon: "📋", label: "Issue Tracking & Escalation" },
                { icon: "🗳️", label: "Locality-Scoped Polls" },
                { icon: "🤖", label: "AI Moderation (Gemini)" },
                { icon: "📊", label: "Official Dashboards" },
                { icon: "⚡", label: "Real-time via Socket.io" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-base">{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How CivicPulse Works</h2>
            <p className="mx-auto max-w-lg text-slate-600">
              A 4-tier hierarchy — Locality → Colony → Municipality → City — ensures
              every issue reaches the right decision-maker automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "📝",
                title: "Citizens Submit Issues",
                desc: "File a civic issue in your locality. It's automatically scoped to your neighbourhood and given an SLA deadline.",
              },
              {
                step: "02",
                icon: "⏰",
                title: "Auto-Escalation Engine",
                desc: "If unresolved by the SLA, the issue automatically escalates up the hierarchy — Colony, Municipality, City — with full audit history.",
              },
              {
                step: "03",
                icon: "📊",
                title: "Officials Get Dashboards",
                desc: "Officials see only their scope. AI summarises discussions, flags risky issues early, and anomalies are highlighted automatically.",
              },
            ].map((card) => (
              <div
                key={card.step}
                className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-colors hover:border-indigo-200"
              >
                <div className="mb-3 text-xs font-mono text-indigo-600/70">{card.step}</div>
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-300 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50 to-sky-50 p-12 text-center shadow-sm">
            <h2 className="text-4xl font-bold mb-4">Ready to shape your community?</h2>
            <p className="mx-auto mb-8 max-w-md text-slate-600">
              Join residents making their voices heard through structured, trustworthy civic engagement.
            </p>
            <Link
              href="/auth/register"
              className="inline-block px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all hover:shadow-lg hover:shadow-indigo-500/25"
            >
              Create Your Account — Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © 2026 CivicPulse · Built for communities, by the community.
      </footer>
    </div>
  );
}
