"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) setError("Invalid email or password.");
    else router.push(res?.url ?? "/");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Mitva PTS</h1>
          <p className="text-sm text-slate-600">Production tracking sign-in</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:ring-brand-600"
            placeholder="admin@mitva.local"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:ring-brand-600"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 text-white py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-xs text-slate-500 pt-2 border-t">
          Default admin (seed): <code>admin@mitva.local</code> / <code>admin123</code>
        </p>
      </form>
    </main>
  );
}
