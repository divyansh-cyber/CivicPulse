"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getToken, getUser } from "@/lib/api";

type UserInfo = { name: string; role: string; email: string };

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthRoute = pathname.startsWith("/auth");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = getToken();
    if (!token) {
      clearAuth();
      setHasSession(false);
      setUser(null);
      return;
    }

    setHasSession(true);
    setUser(getUser<UserInfo>());
  }, [pathname, mounted]);

  function logout() {
    clearAuth();
    router.push("/auth/login");
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navLinks = [
    { href: "/feed", label: "Feed" },
    { href: "/issues", label: "Issues" },
    { href: "/polls", label: "Polls" },
    { href: "/discussions", label: "Discussions" },
    ...(hasSession && (user?.role === "official" || user?.role === "moderator")
      ? [{ href: "/dashboard", label: "Dashboard" }]
      : []),
    ...(hasSession ? [{ href: "/profile", label: "Profile" }] : []),
  ];

  if (isAuthRoute) {
    return (
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm shadow-slate-200/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🏛️</span>
              <span className="text-lg font-bold text-indigo-700">CivicPulse</span>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm shadow-slate-200/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏛️</span>
            <span className="text-lg font-bold text-indigo-700">CivicPulse</span>
          </Link>

          {/* Desktop nav */}
          {mounted && hasSession && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            {mounted && hasSession && user ? (
              <>
                <Link
                  href="/profile"
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-slate-100 ${
                    isActive("/profile") ? "bg-indigo-50" : ""
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-slate-700">{user.name}</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {user.role}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          {mounted && hasSession && (
            <button
              className="md:hidden text-slate-600 hover:text-slate-900 p-2"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="text-xl">{menuOpen ? "✕" : "☰"}</span>
            </button>
          )}
        </div>

        {/* Mobile menu */}
        {mounted && hasSession && menuOpen && (
          <div className="md:hidden pb-4 border-t border-slate-200 mt-2 pt-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(link.href)
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-200 mt-2">
              {mounted && hasSession && user ? (
                <button onClick={logout} className="text-sm text-slate-600 px-3 py-2">
                  Logout ({user.name})
                </button>
              ) : (
                <div className="flex gap-3 px-3">
                  <Link href="/auth/login" className="text-sm text-slate-600">Login</Link>
                  <Link href="/auth/register" className="text-sm text-indigo-600">Register</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
