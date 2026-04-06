"use client";

import { useEffect, useState } from "react";

interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: string;
}

interface UploadStats {
  totalWithoutVideo: number;
  shortsWithoutVideo: number;
  speechesWithoutVideo: number;
}

interface UploadProgress {
  type: "progress" | "success" | "error" | "complete";
  current: number;
  total: number;
  speechId?: string;
  title?: string;
  message?: string;
  status?: "downloading" | "transcoding" | "uploading" | "updating";
}

interface UploadResult {
  successful: number;
  failed: number;
  errors: string[];
}

export default function VideoUpload() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"all" | "shorts" | "videos">("all");
  const [quality, setQuality] = useState<480 | 720 | 1080>(720);
  const [limit, setLimit] = useState(10);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const response = await fetch("/api/videos/upload-stats");
    const data = await response.json();
    setChannels(data.channels || []);
    setStats(data.stats || null);
    setLoading(false);
  }

  function addLog(message: string) {
    setLogs((current) => [...current, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  async function handleStartUpload() {
    if (selectedChannels.length === 0) {
      alert("Please select at least one source");
      return;
    }

    setIsUploading(true);
    setProgress(null);
    setResult(null);
    setLogs([]);
    addLog("Starting upload process...");

    try {
      const response = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: selectedChannels,
          uploadMode,
          quality,
          limit,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start upload");
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
          if (data.type === "progress") {
            setProgress(data);
            addLog(`[${data.current}/${data.total}] ${data.title} - ${data.status}`);
          } else if (data.type === "success") {
            addLog(`Uploaded ${data.title}`);
          } else if (data.type === "error") {
            addLog(`Error: ${data.message}`);
          } else if (data.type === "complete") {
            setResult(data.result);
            addLog("Upload complete");
          }
        }
      }

      await fetchData();
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  if (loading) {
    return <Loader label="Loading upload queue..." />;
  }

  const estimatedCount =
    uploadMode === "all"
      ? stats?.totalWithoutVideo || 0
      : uploadMode === "shorts"
        ? stats?.shortsWithoutVideo || 0
        : stats?.speechesWithoutVideo || 0;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Video Upload</h1>
      <p className="mb-8 text-neutral-400">
        Download missing YouTube files, transcode when needed, and upload them to Appwrite
        Storage.
      </p>

      {stats && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-sky-300">Videos Missing Files</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card label="Total" value={stats.totalWithoutVideo} />
            <Card label="Videos" value={stats.speechesWithoutVideo} accent="sky" />
            <Card label="Shorts" value={stats.shortsWithoutVideo} accent="purple" />
          </div>
        </div>
      )}

      <div className="mb-8 rounded-lg border border-neutral-700 bg-neutral-800 p-6">
        <h2 className="mb-6 text-xl font-semibold">Upload Configuration</h2>

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
                  onChange={() =>
                    setSelectedChannels((current) =>
                      current.includes(channel.youtubeChannelId)
                        ? current.filter((id) => id !== channel.youtubeChannelId)
                        : [...current, channel.youtubeChannelId]
                    )
                  }
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
          <label className="mb-3 block text-sm font-medium text-neutral-300">Upload Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "all", label: "All" },
              { key: "videos", label: "Videos" },
              { key: "shorts", label: "Shorts" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setUploadMode(option.key as "all" | "videos" | "shorts")}
                className={`rounded-lg border p-3 transition-colors ${
                  uploadMode === option.key
                    ? "border-sky-500 bg-sky-900/30 text-sky-400"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6">
          <div>
            <label className="mb-3 block text-sm font-medium text-neutral-300">Video Quality</label>
            <select
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value, 10) as 480 | 720 | 1080)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
            >
              <option value={480}>480p</option>
              <option value={720}>720p</option>
              <option value={1080}>1080p</option>
            </select>
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-neutral-300">Limit</label>
            <input
              type="number"
              min="1"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10) || 10)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-400">
          Estimated matching items: <span className="font-semibold text-white">{estimatedCount}</span>
        </div>

        <button
          onClick={handleStartUpload}
          disabled={isUploading || selectedChannels.length === 0}
          className="w-full rounded-lg bg-sky-600 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-700"
        >
          {isUploading ? "Uploading..." : "Start Upload"}
        </button>
      </div>

      {(progress || logs.length > 0) && (
        <div className="mb-8 rounded-lg border border-neutral-700 bg-neutral-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Progress</h2>
          {progress && (
            <div className="mb-4 text-sm text-neutral-300">
              {progress.current}/{progress.total} • {progress.title}
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

      {result && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Upload Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card label="Successful" value={result.successful} accent="green" />
            <Card label="Failed" value={result.failed} accent="red" />
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

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "sky" | "purple" | "green" | "red";
}) {
  const accentClass =
    accent === "sky"
      ? "text-sky-400"
      : accent === "purple"
        ? "text-purple-400"
        : accent === "green"
          ? "text-green-400"
          : accent === "red"
            ? "text-red-400"
            : "text-white";

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
      <div className={`text-2xl font-bold ${accentClass}`}>{value.toLocaleString()}</div>
      <div className="text-sm text-neutral-400">{label}</div>
    </div>
  );
}
