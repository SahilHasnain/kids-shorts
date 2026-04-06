import AdminHeader from "@/components/AdminHeader";
import Link from "next/link";

const cards = [
  {
    href: "/database",
    icon: "DB",
    title: "Database Inspector",
    description: "Inspect sources, video counts, shorts split, durations, and storage coverage.",
  },
  {
    href: "/channels",
    icon: "CH",
    title: "Channel Management",
    description: "Add or remove YouTube channels and playlists used as ingest sources.",
  },
  {
    href: "/ingest",
    icon: "IG",
    title: "Video Ingestion",
    description: "Pull metadata from YouTube and create missing video documents in Appwrite.",
  },
  {
    href: "/videos",
    icon: "UP",
    title: "Video Upload",
    description: "Download, transcode, and upload missing files into Appwrite Storage.",
  },
];

export default function AdminPage() {
  return (
    <>
      <AdminHeader />
      <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/12 via-cyan-500/6 to-transparent p-8">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-cyan-300/70">
              Kids Shorts Admin
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">
              Operations console for ingesting and maintaining the kids video catalog.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-400">
              This admin mirrors the speech app workflow, adapted for the kids-shorts
              schema, source types, and upload pipeline.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                  {card.icon}
                </div>
                <h2 className="text-xl font-semibold">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-400">{card.description}</p>
                <p className="mt-5 text-sm font-medium text-cyan-300 transition group-hover:text-cyan-200">
                  Open workspace
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
