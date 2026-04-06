"use client";

import { useEffect, useState } from "react";

interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: string;
}

interface IngestResult {
  channelId: string;
  channelName: string;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  filteredDurationCount: number;
  totalVideos: number;
  error?: string;
}

export default function SpeechIngest() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [ingestMode, setIngestMode] = useState<"all" | "shorts" | "videos">("all");
  const [limit, setLimit] = useState<number | null>(null);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [currentChannel, setCurrentChannel] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<IngestResult[]>([]);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    setLoading(true);
    const response = await fetch("/api/channels");
    const data = await response.json();
    setChannels(data.channels || []);
    setLoading(false);
  }

  function toggleChannel(channelId: string) {
    setSelectedChannels((current) =>
      current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId]
    );
  }

  function addLog(message: string) {
    setLogs((current) => [...current, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  async function handleStartIngest() {
    if (selectedChannels.length === 0) {
      alert("Please select at least one source");
      return;
    }

    setIsIngesting(true);
    setLogs([]);
    setResults([]);
    setCurrentChannel("");
    addLog("Starting ingestion...");

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: selectedChannels,
          ingestMode,
          limit: limitEnabled ? limit : null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start ingestion");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            continue;
          }

          const data = JSON.parse(line.slice(6));
          if (data.type === "channel_start") {
            setCurrentChannel(data.channelName || "");
            addLog(`Processing ${data.channelName}`);
          } else if (data.type === "success") {
            addLog(`Added ${data.videoTitle}`);
          } else if (data.type === "error") {
            addLog(`Error: ${data.message}`);
          } else if (data.type === "channel_complete") {
            addLog(`Completed ${data.result.channelName}`);
          } else if (data.type === "complete") {
            setResults(data.results || []);
            addLog("Ingestion complete");
          }
        }
      }
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setIsIngesting(false);
      setCurrentChannel("");
    }
  }

  if (loading) {
    return <Loader label="Loading sources..." />;
  }

  const totalNew = results.reduce((sum, result) => sum + result.newCount, 0);
  const totalFiltered = results.reduce((sum, result) => sum + result.filteredDurationCount, 0);
  const totalErrors = results.reduce((sum, result) => sum + result.errorCount, 0);

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Video Ingestion</h1>
      <p className="mb-8 text-neutral-400">
        Fetch metadata from YouTube and create missing video documents in the kids-shorts
        database.
      </p>

      <div className="mb-8 rounded-lg border border-neutral-700 bg-neutral-800 p-6">
        <h2 className="mb-6 text-xl font-semibold">Ingestion Configuration</h2>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-300">Select Sources</label>
            <button
              onClick={() =>
                setSelectedChannels(
                  selectedChannels.length === channels.length
                    ? []
                    : channels.map((channel) => channel.youtubeChannelId)
                )
              }
              className="text-sm text-sky-400 transition-colors hover:text-sky-300"
            >
              {selectedChannels.length === channels.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {channels.map((channel) => (
              <label
                key={channel.$id}
                className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-3 transition-colors hover:border-neutral-600"
              >
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.youtubeChannelId)}
                  onChange={() => toggleChannel(channel.youtubeChannelId)}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-white">{channel.name}</span>
                <span className="block text-xs text-neutral-400">
                  {channel.type} • {channel.youtubeChannelId}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-neutral-300">Ingest Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "all", label: "All" },
              { key: "videos", label: "Videos" },
              { key: "shorts", label: "Shorts" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setIngestMode(option.key as "all" | "videos" | "shorts")}
                className={`rounded-lg border p-3 transition-colors ${
                  ingestMode === option.key
                    ? "border-sky-500 bg-sky-900/30 text-sky-400"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-3 flex items-center">
            <input
              type="checkbox"
              checked={limitEnabled}
              onChange={(e) => setLimitEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-neutral-300">Limit videos per source</span>
          </label>
          {limitEnabled && (
            <input
              type="number"
              min="1"
              value={limit || 100}
              onChange={(e) => setLimit(parseInt(e.target.value, 10) || 100)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
            />
          )}
        </div>

        <button
          onClick={handleStartIngest}
          disabled={isIngesting || selectedChannels.length === 0}
          className="w-full rounded-lg bg-sky-600 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-700"
        >
          {isIngesting ? "Ingesting..." : "Start Ingestion"}
        </button>
      </div>

      {(isIngesting || logs.length > 0) && (
        <div className="mb-8 rounded-lg border border-neutral-700 bg-neutral-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Progress</h2>
          {currentChannel && (
            <div className="mb-4 text-sm">
              <span className="text-neutral-400">Current: </span>
              <span className="text-white">{currentChannel}</span>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto rounded-lg bg-neutral-900 p-4">
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, index) => (
                <div key={index} className="text-neutral-400">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Results Summary</h2>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <StatCard label="New Videos" value={totalNew} tone="green" />
            <StatCard label="Filtered" value={totalFiltered} tone="amber" />
            <StatCard label="Errors" value={totalErrors} tone="red" />
          </div>
        </div>
      )}
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-sky-400" />
        <p className="text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-700 bg-green-900/20 text-green-400"
      : tone === "amber"
        ? "border-amber-700 bg-amber-900/20 text-amber-400"
        : "border-red-700 bg-red-900/20 text-red-400";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-neutral-400">{label}</div>
    </div>
  );
}
