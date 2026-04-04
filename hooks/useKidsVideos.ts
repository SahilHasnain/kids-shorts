import { config, databases } from "@/config/appwrite";
import { Speech } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useState } from "react";

const VIDEOS_PER_PAGE = 20;

export function useKidsVideos() {
  const [videos, setVideos] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [kidsChannelIds, setKidsChannelIds] = useState<string[]>([]);

  // Fetch kids channel IDs
  const fetchKidsChannels = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.equal("isKidsChannel", true)]
      );
      
      const youtubeChannelIds = response.documents.map(doc => doc.youtubeChannelId);
      console.log(`✅ Found ${youtubeChannelIds.length} kids channels for videos`);
      setKidsChannelIds(youtubeChannelIds);
      return youtubeChannelIds;
    } catch (err) {
      console.error("Error fetching kids channels:", err);
      return [];
    }
  }, []);

  // Fetch videos (non-shorts)
  const fetchVideos = useCallback(async (channelIds: string[], currentOffset: number = 0) => {
    if (channelIds.length === 0) {
      console.log("⚠️ No kids channels found");
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);

      const queries = [
        // Query.equal("isShort", false), // Temporarily commented out - fetch all videos including shorts
        Query.equal("channelId", channelIds),
        Query.isNotNull("videoId"),
        Query.notEqual("videoId", ""),
        Query.orderDesc("uploadDate"),
        Query.limit(VIDEOS_PER_PAGE),
        Query.offset(currentOffset),
      ];

      const response = await databases.listDocuments(
        config.databaseId,
        config.speechesCollectionId,
        queries
      );

      const fetchedVideos = response.documents as unknown as Speech[];
      console.log(`📦 Fetched ${fetchedVideos.length} videos (offset: ${currentOffset})`);

      setHasMore(fetchedVideos.length === VIDEOS_PER_PAGE);
      setError(null);
      
      return fetchedVideos;
    } catch (err) {
      console.error("Error fetching videos:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch videos"));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      const channelIds = await fetchKidsChannels();
      const fetchedVideos = await fetchVideos(channelIds, 0);
      setVideos(fetchedVideos);
      setOffset(VIDEOS_PER_PAGE);
    };

    initialize();
  }, [fetchKidsChannels, fetchVideos]);

  // Load more videos
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || kidsChannelIds.length === 0) return;

    const newVideos = await fetchVideos(kidsChannelIds, offset);
    setVideos((prev) => [...prev, ...newVideos]);
    setOffset((prev) => prev + VIDEOS_PER_PAGE);
  }, [loading, hasMore, kidsChannelIds, offset, fetchVideos]);

  // Refresh videos
  const refresh = useCallback(async () => {
    const channelIds = kidsChannelIds.length > 0 ? kidsChannelIds : await fetchKidsChannels();
    const fetchedVideos = await fetchVideos(channelIds, 0);
    setVideos(fetchedVideos);
    setOffset(VIDEOS_PER_PAGE);
  }, [kidsChannelIds, fetchKidsChannels, fetchVideos]);

  return {
    videos,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
