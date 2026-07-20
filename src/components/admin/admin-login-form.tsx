"use client";

import { BTN_PRIMARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useState } from "react";

type AdminLoginFormProps = {
  labels: { title: string; password: string; login: string };
};

export function AdminLoginForm({ labels }: AdminLoginFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      window.location.href = "/admin/dashboard";
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-ns-hero">{labels.title}</h1>
      <div>
        <label htmlFor="password" className={LABEL_CLASS}>{labels.password}</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={INPUT_CLASS}
          disabled={loading}
        />
      </div>
      {error && <p className={ERROR_TEXT}>Mot de passe incorrect.</p>}
      <button type="submit" className={BTN_PRIMARY} disabled={loading}>
        {labels.login}
      </button>
    </form>
  );
}
