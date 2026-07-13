import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { searchContacts, isDatabasePersoConfigured } from "@/lib/database-perso";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeEmail } from "@/lib/auth/platform-admin";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const results: Array<{
    id: string;
    fullName: string;
    company: string | null;
    emails: string[];
    phones: string[];
    tags: string[];
    source?: string;
  }> = [];

  // Always search waitlist locally for invite picker
  if (isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.waitlist)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      const needle = q.toLowerCase();
      for (const d of snap.docs) {
        const data = d.data();
        const fullName = String(data.fullName ?? "");
        const email = normalizeEmail(String(data.email ?? ""));
        const company = data.company ? String(data.company) : null;
        if (
          fullName.toLowerCase().includes(needle) ||
          email.includes(needle) ||
          (company?.toLowerCase().includes(needle) ?? false)
        ) {
          results.push({
            id: d.id,
            fullName,
            company,
            emails: email ? [email] : [],
            phones: data.phone ? [String(data.phone)] : [],
            tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
            source: "waitlist",
          });
        }
      }
    } catch (error) {
      console.error("[contacts/search] waitlist", error);
    }
  }

  if (isDatabasePersoConfigured()) {
    try {
      const remote = await searchContacts(q);
      for (const c of remote) {
        if (!results.some((r) => r.emails[0] && c.emails.includes(r.emails[0]))) {
          results.push({ ...c, source: "database-perso" });
        }
      }
    } catch (error) {
      console.error("[contacts/search] db perso", error);
    }
  }

  return NextResponse.json({ ok: true, results: results.slice(0, 40) });
}
