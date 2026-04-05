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

  // Fetch all source IDs. Legacy documents without a type field are still valid.
  const fetchKidsChannels = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.limit(100)]
      );

      const youtubeChannelIds = response.documents.map((doc) => doc.youtubeChannelId);
      console.log(`Found ${youtubeChannelIds.length} source(s) for videos`);
      setKidsChannelIds(youtubeChannelIds);
      return youtubeChannelIds;
    } catch (err) {
      console.error("Error fetching sources:", err);
      return [];
    }
  }, []);

  const fetchVideos = useCallback(async (channelIds: string[], currentOffset: number = 0) => {
    if (channelIds.length === 0) {
      console.log("No sources found");
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);

      const queries = [
        Query.equal("isShort", false),
        Query.equal("channelId", channelIds),
        Query.isNotNull("videoId"),
        Query.notEqual("videoId", ""),
        Query.orderDesc("uploadDate"),
        Query.limit(VIDEOS_PER_PAGE),
        Query.offset(currentOffset),
      ];

      const response = await databases.listDocuments(
        config.databaseId,
        config.videosCollectionId,
        queries
      );

      const fetchedVideos = response.documents as unknown as Speech[];
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

  useEffect(() => {
    const initialize = async () => {
      const channelIds = await fetchKidsChannels();
      const fetchedVideos = await fetchVideos(channelIds, 0);
      setVideos(fetchedVideos);
      setOffset(VIDEOS_PER_PAGE);
    };

    initialize();
  }, [fetchKidsChannels, fetchVideos]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || kidsChannelIds.length === 0) return;

    const newVideos = await fetchVideos(kidsChannelIds, offset);
    setVideos((prev) => [...prev, ...newVideos]);
    setOffset((prev) => prev + VIDEOS_PER_PAGE);
  }, [loading, hasMore, kidsChannelIds, offset, fetchVideos]);

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
