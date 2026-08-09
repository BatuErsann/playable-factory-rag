"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { clearLegacyAuthStorage, getCurrentUser, getHomeRoute, login } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clearLegacyAuthStorage();

    getCurrentUser()
      .then((user) => {
        if (!cancelled) router.replace(getHomeRoute(user.role));
      })
      .catch(() => {
        // A missing session is expected on the login page.
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await login(email, password);
      router.replace(getHomeRoute(user.role));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign in failed. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div>
      <h1 className="whitespace-nowrap text-[clamp(1.5rem,2.1vw,1.85rem)] font-bold tracking-[-0.035em] text-white">
        Welcome to Playable Factory!
      </h1>

      <form onSubmit={handleSubmit} className="mt-11">
        <div>
          <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-white">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            disabled={isLoading}
            aria-invalid={Boolean(error)}
            className="h-[59px] w-full rounded-lg border border-[#70a0c8] bg-[#35435e] px-5 text-sm text-white outline-none transition placeholder:font-semibold placeholder:text-[#aab6cc] hover:border-[#8ab6da] focus:border-[#9bc7ea] focus:ring-2 focus:ring-[#6f9fc8]/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="mt-8">
          <label htmlFor="password" className="mb-2 block text-[13px] font-medium text-white">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            disabled={isLoading}
            aria-invalid={Boolean(error)}
            className="h-[59px] w-full rounded-lg border border-[#70a0c8] bg-[#35435e] px-5 text-sm text-white outline-none transition placeholder:font-semibold placeholder:text-[#aab6cc] hover:border-[#8ab6da] focus:border-[#9bc7ea] focus:ring-2 focus:ring-[#6f9fc8]/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-7 text-right text-[13px] font-medium text-[#a9b1c1]">
            Forgot password?
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-5 rounded-lg border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-12 flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#ff8b00] text-sm font-medium text-white shadow-[0_16px_34px_rgba(255,139,0,0.08)] transition hover:bg-[#ff9a19] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff9a19] disabled:cursor-wait disabled:opacity-65"
        >
          {isLoading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Logging in…
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}
