import { LaMesaShell } from "@/components/la-mesa-shell";

export default function EventLoading() {
  return (
    <LaMesaShell card cardClassName="max-w-xl">
      <div className="animate-pulse space-y-4 py-6" aria-hidden>
        <div className="mx-auto h-8 w-2/3 rounded bg-white/10" />
        <div className="mx-auto h-4 w-1/2 rounded bg-white/5" />
        <div className="mt-8 space-y-3">
          <div className="h-24 rounded-xl bg-white/5" />
          <div className="h-10 rounded-lg bg-white/10" />
          <div className="h-10 rounded-lg bg-white/10" />
        </div>
      </div>
    </LaMesaShell>
  );
}
