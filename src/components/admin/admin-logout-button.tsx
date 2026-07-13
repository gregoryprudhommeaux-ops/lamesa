"use client";

import { BTN_GHOST } from "@/lib/ui/nextstep";

export function AdminLogoutButton({ label }: { label: string }) {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button type="button" onClick={() => void logout()} className={BTN_GHOST}>
      {label}
    </button>
  );
}
