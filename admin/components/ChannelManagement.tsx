"use client";

import { useEffect, useState } from "react";

interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: string;
  thumbnailUrl?: string;
  description?: string;
  ignoreDuration: boolean;
  includeShorts: boolean;
}

interface YouTubePreview {
  type: "channel" | "playlist";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  subscriberCount?: number;
  videoCount: number;
}

export default function ChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      setLoading(true);
      const response = await fetch("/api/channels");
      const data = await response.json();
      setChannels(response.ok ? data.channels || [] : []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup() {
    if (!confirm("This will delete orphaned videos whose source channel no longer exists. Continue?")) {
      return;
    }

    try {
      setCleaningUp(true);
      const response = await fetch("/api/channels/cleanup", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to cleanup orphaned videos");
        return;
      }

      alert(
        `Cleanup complete\n\nDeleted video documents: ${data.deletedCount || 0}\nDeleted source files: ${
          (data.deletedVideos || 0) + (data.deletedOrphanedStorageVideos || 0)
        }\nAffected missing channels: ${(data.orphanedChannels || []).length}`
      );
    } finally {
      setCleaningUp(false);
    }
  }

  async function confirmDelete() {
    if (!selectedChannel) {
      return;
    }

    const response = await fetch("/api/channels/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeChannelId: selectedChannel.youtubeChannelId }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Failed to delete channel");
      return;
    }

    await fetchChannels();
    setSelectedChannel(null);
    setShowDeleteModal(false);
    alert(
      `Deleted ${selectedChannel.name}\n\nVideo documents: ${data.deletedVideos || 0}\nStorage files: ${
        data.deletedFiles || 0
      }`
    );
  }

  if (loading) {
    return <Loader label="Loading channels..." />;
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Channel Management</h1>
        <div className="flex gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-white transition-colors hover:bg-amber-600 disabled:bg-neutral-700 disabled:text-neutral-500"
          >
            {cleaningUp ? "Cleaning..." : "Cleanup Orphaned"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-sky-500 px-6 py-2 font-medium text-white transition-colors hover:bg-sky-600"
          >
            Add Channel
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800">
        {channels.length === 0 ? (
          <div className="py-12 text-center text-neutral-400">No channels or playlists added yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Settings
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {channels.map((channel) => (
                  <tr key={channel.$id} className="transition-colors hover:bg-neutral-700/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {channel.thumbnailUrl ? (
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.name}
                            className="mr-4 h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-700 text-xl">
                            {channel.type === "playlist" ? "PL" : "CH"}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{channel.name}</div>
                          <div className="font-mono text-xs text-neutral-400">
                            {channel.youtubeChannelId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
                        {channel.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        {channel.ignoreDuration && (
                          <span className="rounded bg-amber-500/20 px-2 py-1 text-amber-300">
                            Ignore duration
                          </span>
                        )}
                        {channel.includeShorts && (
                          <span className="rounded bg-blue-500/20 px-2 py-1 text-blue-300">
                            Include shorts
                          </span>
                        )}
                        {!channel.ignoreDuration && !channel.includeShorts && (
                          <span className="text-neutral-500">Default</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedChannel(channel);
                          setShowDeleteModal(true);
                        }}
                        className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddChannelModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchChannels();
          }}
        />
      )}

      {showDeleteModal && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">Delete Source</h3>
            <p className="mb-6 text-neutral-300">
              Delete <strong>{selectedChannel.name}</strong> and all associated video
              documents/storage files?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChannel(null);
                }}
                className="rounded-lg bg-neutral-700 px-4 py-2 text-white transition-colors hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </div>
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

function AddChannelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sourceType, setSourceType] = useState<"channel" | "playlist">("channel");
  const [sourceId, setSourceId] = useState("");
  const [ignoreDuration, setIgnoreDuration] = useState(false);
  const [includeShorts, setIncludeShorts] = useState(true);
  const [preview, setPreview] = useState<YouTubePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function fetchPreview() {
    if (!sourceId.trim()) {
      setError("Please enter a channel or playlist ID");
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch("/api/youtube/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: sourceId.trim(), sourceType }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Failed to fetch preview");
      setPreview(null);
      return;
    }

    setPreview(data.info);
  }

  async function handleAdd() {
    setAdding(true);
    setError("");
    const response = await fetch("/api/channels/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: sourceId.trim(),
        sourceType,
        ignoreDuration,
        includeShorts,
      }),
    });
    const data = await response.json();
    setAdding(false);

    if (!response.ok) {
      setError(data.error || "Failed to add source");
      return;
    }

    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-lg border border-neutral-700 bg-neutral-800">
        <div className="flex items-center justify-between rounded-t-lg border-b border-neutral-700 bg-neutral-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-white">Add Source</h3>
          <button onClick={onClose} className="text-neutral-400 transition-colors hover:text-white">
            Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-300">Source Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="channel"
                  checked={sourceType === "channel"}
                  onChange={() => {
                    setSourceType("channel");
                    setPreview(null);
                  }}
                  className="mr-2"
                />
                <span className="text-white">YouTube Channel</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="playlist"
                  checked={sourceType === "playlist"}
                  onChange={() => {
                    setSourceType("playlist");
                    setPreview(null);
                  }}
                  className="mr-2"
                />
                <span className="text-white">YouTube Playlist</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-300">
              {sourceType === "channel" ? "Channel ID" : "Playlist ID"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setPreview(null);
                }}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                placeholder={sourceType === "channel" ? "UC..." : "PL..."}
              />
              <button
                onClick={fetchPreview}
                disabled={loading || !sourceId.trim()}
                className="rounded-lg bg-sky-500 px-6 py-2 font-medium text-white transition-colors hover:bg-sky-600 disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {loading ? "Loading..." : "Preview"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
              <div className="flex items-start gap-4">
                <img
                  src={preview.thumbnailUrl}
                  alt={preview.name}
                  className="h-24 w-24 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="mb-1 text-lg font-semibold text-white">{preview.name}</h4>
                  <p className="mb-2 line-clamp-2 text-sm text-neutral-400">{preview.description}</p>
                  <div className="flex gap-4 text-sm text-neutral-400">
                    {preview.subscriberCount !== undefined && (
                      <span>{preview.subscriberCount.toLocaleString()} subscribers</span>
                    )}
                    <span>{preview.videoCount.toLocaleString()} videos</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t border-neutral-700 pt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={ignoreDuration}
                    onChange={(e) => setIgnoreDuration(e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-white">Ignore duration limit</span>
                    <p className="text-xs text-neutral-400">
                      Keep long-form videos instead of relying only on shorts logic.
                    </p>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeShorts}
                    onChange={(e) => setIncludeShorts(e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-white">Include shorts</span>
                    <p className="text-xs text-neutral-400">
                      For channels, include Shorts playlist items during ingest.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-neutral-700 px-4 py-2 text-white transition-colors hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-white transition-colors hover:bg-sky-600 disabled:bg-neutral-700"
                >
                  {adding ? "Adding..." : "Add Source"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
