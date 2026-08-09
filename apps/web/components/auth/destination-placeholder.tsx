"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUser, getHomeRoute, logout, type UserRole } from "@/lib/auth";

type DestinationPlaceholderProps = {
  requiredRole?: UserRole;
  title: string;
};

export function DestinationPlaceholder({ requiredRole, title }: DestinationPlaceholderProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        if (requiredRole && user.role !== requiredRole) {
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
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">Coming next</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-white/45">
        Your session is active. This route is ready for the next UI phase.
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 rounded-lg border border-[#70a0c8] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
      >
        Sign out
      </button>
    </div>
  );
}
