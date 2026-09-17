"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(tr.auth.loginError);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-7 rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            {tr.auth.email}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            {tr.auth.password}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="rememberMe" className="text-sm text-gray-600">
            {tr.auth.rememberMe}
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {loading ? tr.common.loading : tr.auth.login}
        </button>
      </form>

      <p className="text-center text-sm">
        <Link href="/sifremi-unuttum" className="text-brand-700 hover:underline">
          {tr.passwordReset.forgotLink}
        </Link>
      </p>
    </div>
  );
}
