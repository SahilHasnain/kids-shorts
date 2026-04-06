import { ID } from "node-appwrite";
import { getAppwriteClient, Query } from "@/lib/appwrite";
import { appConfig } from "@/lib/config";

export interface IngestConfig {
  channels: string[];
  ingestMode: "all" | "shorts" | "videos";
  limit: number | null;
}

interface Source {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: "channel" | "playlist";
  includeShorts?: boolean;
}

interface VideoData {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  uploadDate: string;
}

interface PlaylistItem {
  contentDetails: {
    videoId: string;
  };
}

interface YoutubeVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  contentDetails: {
    duration: string;
  };
}

interface ChannelDocument {
  youtubeChannelId: string;
}

export interface IngestResult {
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

export interface ProgressCallback {
  (data: {
    type: "progress" | "success" | "error" | "complete" | "channel_start" | "channel_complete";
    channelId?: string;
    channelName?: string;
    videoTitle?: string;
    message?: string;
    result?: IngestResult;
  }): void;
}

const BASE_URL = "https://www.googleapis.com/youtube/v3";

function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }

  return (
    parseInt(match[1] || "0", 10) * 3600 +
    parseInt(match[2] || "0", 10) * 60 +
    parseInt(match[3] || "0", 10)
  );
}

async function getShortsVideoIds(channelId: string) {
  const shortsPlaylistId = channelId.replace("UC", "UUSH");
  const shortsIds = new Set<string>();
  let pageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId: shortsPlaylistId,
      maxResults: "50",
      key: appConfig.youtubeApiKey,
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`${BASE_URL}/playlistItems?${params.toString()}`);
    if (!response.ok) {
      break;
    }

    const data = await response.json();
    for (const item of data.items || []) {
      shortsIds.add(item.contentDetails.videoId);
    }

    if (!data.nextPageToken) {
      break;
    }

    pageToken = data.nextPageToken;
  }

  return shortsIds;
}

async function fetchPlaylistItems(playlistId: string, limit: number | null) {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  while (limit === null || items.length < limit) {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId,
      maxResults: "50",
      key: appConfig.youtubeApiKey,
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`${BASE_URL}/playlistItems?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    items.push(...((data.items || []) as PlaylistItem[]));

    if (!data.nextPageToken || !(data.items || []).length) {
      break;
    }

    pageToken = data.nextPageToken;
  }

  return limit === null ? items : items.slice(0, limit);
}

async function fetchVideosByIds(videoIds: string[]) {
  const response = await fetch(
    `${BASE_URL}/videos?part=contentDetails,snippet&id=${videoIds.join(",")}&key=${appConfig.youtubeApiKey}`
  );

  if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
  }

  const data = await response.json();
  return ((data.items || []) as YoutubeVideoItem[]).map(
    (video): VideoData => ({
      youtubeId: video.id,
      title: video.snippet.title,
      thumbnailUrl:
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium?.url ||
        video.snippet.thumbnails.default?.url ||
        "",
      duration: parseDuration(video.contentDetails.duration),
      uploadDate: video.snippet.publishedAt,
    })
  );
}

async function fetchSourceVideos(source: Source, limit: number | null) {
  if (source.type === "playlist") {
    const items = await fetchPlaylistItems(source.youtubeChannelId, limit);
    const ids = items.map((item) => item.contentDetails.videoId);
    const videos: VideoData[] = [];

    for (let i = 0; i < ids.length; i += 50) {
      videos.push(...(await fetchVideosByIds(ids.slice(i, i + 50))));
    }

    return { channelName: source.name, videos };
  }

  const channelResponse = await fetch(
    `${BASE_URL}/channels?part=contentDetails,snippet&id=${source.youtubeChannelId}&key=${appConfig.youtubeApiKey}`
  );

  if (!channelResponse.ok) {
    throw new Error(`YouTube API error: ${channelResponse.status}`);
  }

  const channelData = await channelResponse.json();
  const channel = channelData.items?.[0] as
    | {
        snippet: { title: string };
        contentDetails: { relatedPlaylists: { uploads: string } };
      }
    | undefined;

  if (!channel) {
    throw new Error(`Channel not found: ${source.youtubeChannelId}`);
  }

  const shortsIds = source.includeShorts ? new Set<string>() : await getShortsVideoIds(source.youtubeChannelId);
  const items = await fetchPlaylistItems(channel.contentDetails.relatedPlaylists.uploads, limit);
  const filteredIds = items
    .map((item) => item.contentDetails.videoId)
    .filter((id) => !shortsIds.has(id));
  const videos: VideoData[] = [];

  for (let i = 0; i < filteredIds.length; i += 50) {
    videos.push(...(await fetchVideosByIds(filteredIds.slice(i, i + 50))));
  }

  return { channelName: channel.snippet.title, videos };
}

async function getExistingVideoMap() {
  const { databases } = getAppwriteClient();
  const existing = new Map<string, string>();
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    for (const document of response.documents) {
      existing.set(document.youtubeId, document.$id);
    }

    if (response.documents.length < limit) {
      break;
    }

    offset += limit;
  }

  return existing;
}

async function getSelectedSources(channelIds: string[]) {
  const { databases } = getAppwriteClient();
  const selected: Source[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.channelsCollectionId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    const matches = (response.documents as unknown as ChannelDocument[]).filter((source) =>
      channelIds.includes(source.youtubeChannelId)
    );
    selected.push(...(matches as Source[]));

    if (response.documents.length < limit) {
      break;
    }

    offset += limit;
  }

  return selected;
}

export async function ingestSpeeches(config: IngestConfig, progressCallback: ProgressCallback) {
  const { databases } = getAppwriteClient();
  const existingMap = await getExistingVideoMap();
  const sources = await getSelectedSources(config.channels);
  const results: IngestResult[] = [];

  for (const source of sources) {
    progressCallback({
      type: "channel_start",
      channelId: source.youtubeChannelId,
      channelName: source.name,
      message: "Fetching videos from YouTube...",
    });

    try {
      const { channelName, videos } = await fetchSourceVideos(source, config.limit);
      let newCount = 0;
      let unchangedCount = 0;
      let errorCount = 0;
      let filteredDurationCount = 0;

      for (const video of videos) {
        const isShort = video.duration < 60;

        if (config.ingestMode === "shorts" && !isShort) {
          filteredDurationCount += 1;
          continue;
        }

        if (config.ingestMode === "videos" && isShort) {
          filteredDurationCount += 1;
          continue;
        }

        if (existingMap.has(video.youtubeId)) {
          unchangedCount += 1;
          continue;
        }

        try {
          await databases.createDocument(appConfig.databaseId, appConfig.videosCollectionId, ID.unique(), {
            title: video.title,
            youtubeId: video.youtubeId,
            videoId: null,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            uploadDate: video.uploadDate,
            channelId: source.youtubeChannelId,
            channelName,
            isShort,
          });

          existingMap.set(video.youtubeId, video.youtubeId);
          newCount += 1;
          progressCallback({
            type: "success",
            channelId: source.youtubeChannelId,
            channelName: source.name,
            videoTitle: video.title,
            message: "Added video metadata",
          });
        } catch (error) {
          errorCount += 1;
          progressCallback({
            type: "error",
            channelId: source.youtubeChannelId,
            channelName: source.name,
            videoTitle: video.title,
            message: error instanceof Error ? error.message : "Failed to add video",
          });
        }
      }

      const result: IngestResult = {
        channelId: source.youtubeChannelId,
        channelName: source.name,
        newCount,
        updatedCount: 0,
        unchangedCount,
        errorCount,
        filteredDurationCount,
        totalVideos: videos.length,
      };

      results.push(result);
      progressCallback({ type: "channel_complete", result });
    } catch (error) {
      const result: IngestResult = {
        channelId: source.youtubeChannelId,
        channelName: source.name,
        newCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: 1,
        filteredDurationCount: 0,
        totalVideos: 0,
        error: error instanceof Error ? error.message : "Failed to ingest source",
      };

      results.push(result);
      progressCallback({ type: "channel_complete", result });
    }
  }

  return results;
}
