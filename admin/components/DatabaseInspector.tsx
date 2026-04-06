"use client";

import { useEffect, useState } from "react";

interface DatabaseStats {
  totalDocuments: number;
  totalSpeeches: number;
  totalShorts: number;
  channelsCount: number;
  videoFilesCount: number;
}

interface ChannelStats {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: string;
  ignoreDuration: boolean;
  includeShorts: boolean;
  totalCount: number;
  speechesOnlyCount: number;
  shortsCount: number;
  videoCount: number;
}

interface ChannelDetails extends ChannelStats {
  total: number;
  speechesOnly: number;
  shorts: number;
  speechVideoCount: number;
  shortVideoCount: number;
  under20Min: number;
  over20Min: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  documentsWithoutVideo: number;
}

export default function DatabaseInspector() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function fetchChannelDetails(channelId: string) {
    setLoadingDetails(true);
    setSelectedChannel(channelId);
    const response = await fetch(`/api/database/channel/${channelId}`);
    const data = await response.json();
    setChannelDetails(data);
    setLoadingDetails(false);
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/database/stats");
      const data = await response.json();

      if (!active) {
        return;
      }

      setStats(data.stats);
      setChannels(data.channels || []);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <Loader label="Loading database statistics..." />;
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-8 text-3xl font-bold">Database Inspector</h1>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-sky-300">Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <StatCard label="Total Documents" value={stats?.totalDocuments || 0} />
          <StatCard label="Videos" value={stats?.totalSpeeches || 0} accent="sky" />
          <StatCard label="Shorts" value={stats?.totalShorts || 0} accent="purple" />
          <StatCard label="Sources" value={stats?.channelsCount || 0} />
          <StatCard label="Storage Files" value={stats?.videoFilesCount || 0} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-sky-300">Sources</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800">
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
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Videos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Shorts
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Files
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Coverage
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {channels.map((channel) => {
                  const coverage =
                    channel.totalCount > 0 ? ((channel.videoCount / channel.totalCount) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={channel.$id} className="transition-colors hover:bg-neutral-700/30">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">{channel.name}</div>
                          <div className="font-mono text-xs text-neutral-400">{channel.youtubeChannelId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
                          {channel.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-white">
                        {channel.totalCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-sky-400">
                        {channel.speechesOnlyCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-purple-400">
                        {channel.shortsCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-white">
                        {channel.videoCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-white">{coverage}%</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => fetchChannelDetails(channel.youtubeChannelId)}
                          className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-6 py-4">
              <h3 className="text-xl font-semibold text-white">
                {channelDetails?.name || "Loading..."}
              </h3>
              <button
                onClick={() => {
                  setSelectedChannel(null);
                  setChannelDetails(null);
                }}
                className="text-neutral-400 transition-colors hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="p-6">
              {loadingDetails ? (
                <Loader label="Loading source details..." />
              ) : channelDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard label="Total" value={channelDetails.total} />
                    <StatCard label="Videos" value={channelDetails.speechesOnly} accent="sky" />
                    <StatCard label="Shorts" value={channelDetails.shorts} accent="purple" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <StatCard label="Files For Videos" value={channelDetails.speechVideoCount} />
                    <StatCard label="Files For Shorts" value={channelDetails.shortVideoCount} />
                    <StatCard
                      label="Without Files"
                      value={channelDetails.documentsWithoutVideo}
                      accent="amber"
                    />
                  </div>

                  <div className="rounded-lg bg-neutral-900 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-neutral-300">Duration Stats</h4>
                    <div className="space-y-2 text-sm text-neutral-400">
                      <div>Total Duration: <span className="text-white">{formatDuration(channelDetails.totalDuration)}</span></div>
                      <div>Average: <span className="text-white">{formatDuration(Math.round(channelDetails.avgDuration))}</span></div>
                      <div>Longest: <span className="text-white">{formatDuration(channelDetails.maxDuration)}</span></div>
                      <div>Shortest: <span className="text-white">{formatDuration(channelDetails.minDuration)}</span></div>
                      <div>Under 20 min: <span className="text-white">{channelDetails.under20Min}</span></div>
                      <div>20 min and over: <span className="text-white">{channelDetails.over20Min}</span></div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center">
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
  accent,
}: {
  label: string;
  value: number;
  accent?: "sky" | "purple" | "amber";
}) {
  const accentClass =
    accent === "sky"
      ? "text-sky-400"
      : accent === "purple"
        ? "text-purple-400"
        : accent === "amber"
          ? "text-amber-400"
          : "text-white";

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
      <div className={`text-2xl font-bold ${accentClass}`}>{value.toLocaleString()}</div>
      <div className="text-sm text-neutral-400">{label}</div>
    </div>
  );
}
