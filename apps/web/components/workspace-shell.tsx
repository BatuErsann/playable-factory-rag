"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { ApiError } from "@/lib/api";
import { getCurrentUser, getHomeRoute, logout, type UserRole } from "@/lib/auth";

type WorkspaceShellProps = {
  activePage: "chat" | "admin";
  children: ReactNode;
  requiredRole?: UserRole;
  title: string;
};

const navItems = [
  { href: "/chat", label: "AI Chat", icon: ChatIcon },
  { href: "/admin", label: "Admin", icon: DashboardIcon },
] as const;

export function WorkspaceShell({
  activePage,
  children,
  requiredRole,
  title,
}: WorkspaceShellProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (!cancelled && requiredRole && user.role !== requiredRole) {
          router.replace(getHomeRoute(user.role));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <main className="min-h-dvh bg-[#09152a] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col border-r border-white/[0.07] bg-[#0b1830] px-5 py-6 md:flex">
        <BrandMark />

        <nav className="mt-12 space-y-2" aria-label="Workspace navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = activePage === href.slice(1);
            return (
              <Link
                key={href}
                href={href}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#ff8b00] text-white shadow-[0_10px_28px_rgba(255,139,0,0.14)]"
                    : "text-white/48 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/[0.07] pt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex min-h-dvh flex-col md:pl-[260px]">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0a172d]/85 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <BrandMark />
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-semibold text-white">{title}</h1>
              <p className="mt-0.5 text-[11px] text-white/35">Playable Factory AI workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.75)]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Online</span>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 11.5a7.5 7.5 0 0 1-8 7.47 8.8 8.8 0 0 1-3.55-.98L4 19l1.26-3.52A7.5 7.5 0 1 1 20 11.5Z" strokeLinejoin="round" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeLinecap="round" strokeWidth="2.3" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" />
      <path d="m15 8 4 4-4 4M19 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
