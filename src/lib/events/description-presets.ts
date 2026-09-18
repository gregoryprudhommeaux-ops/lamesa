import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export type EventDescriptionPreset = {
  id: string;
  name: string;
  introText: string;
  subtitle: string;
  menuIncluded: string;
  updatedAt: string;
  createdAt: string;
};

export type EventDescriptionPresetInput = {
  name: string;
  introText?: string;
  subtitle?: string;
  menuIncluded?: string;
};

export async function listEventDescriptionPresets(): Promise<EventDescriptionPreset[]> {
  if (!isFirebaseAdminConfigured()) return [];
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.eventDescriptionPresets)
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name ?? ""),
      introText: String(data.introText ?? ""),
      subtitle: String(data.subtitle ?? ""),
      menuIncluded: String(data.menuIncluded ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
      createdAt: String(data.createdAt ?? ""),
    };
  });
}

export async function createEventDescriptionPreset(
  input: EventDescriptionPresetInput,
): Promise<EventDescriptionPreset> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const ref = await db.collection(COLLECTIONS.eventDescriptionPresets).add({
    name: input.name.trim(),
    introText: (input.introText ?? "").trim(),
    subtitle: (input.subtitle ?? "").trim(),
    menuIncluded: (input.menuIncluded ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: ref.id,
    name: input.name.trim(),
    introText: (input.introText ?? "").trim(),
    subtitle: (input.subtitle ?? "").trim(),
    menuIncluded: (input.menuIncluded ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteEventDescriptionPreset(id: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.eventDescriptionPresets).doc(id).delete();
}
