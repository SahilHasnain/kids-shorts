import { config, databases } from "@/config/appwrite";
import { Speech } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useRef, useState } from "react";

const SHORTS_SERVE_SIZE = 10;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface UseKidsShortsOptions {
  seenShortIds?: string[];
}

export function useKidsShorts(options: UseKidsShortsOptions = {}) {
  const { seenShortIds = [] } = options;
  
  const [allShorts, setAllShorts] = useState<Speech[]>([]);
  const [displayShorts, setDisplayShorts] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [kidsChannelIds, setKidsChannelIds] = useState<string[]>([]);
  const initialSeenIdsRef = useRef<string[]>([]);
  const servedShortsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initialSeenIdsRef.current = seenShortIds;
  }, []);

  // Fetch kids channel IDs
  const fetchKidsChannels = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.equal("isKidsChannel", true)]
      );
      
      // Get YouTube channel IDs, not document IDs
      const youtubeChannelIds = response.documents.map(doc => doc.youtubeChannelId);
      console.log(`✅ Found ${youtubeChannelIds.length} kids channels:`, youtubeChannelIds);
      console.log(`📋 Channel details:`, response.documents.map(d => ({ 
        docId: d.$id, 
        name: d.name, 
        youtubeId: d.youtubeChannelId 
      })));
      setKidsChannelIds(youtubeChannelIds);
      return youtubeChannelIds;
    } catch (err) {
      console.error("Error fetching kids channels:", err);
      return [];
    }
  }, []);

  // Fetch all shorts from kids channels
  const fetchAllShorts = useCallback(async (channelIds: string[]) => {
    if (channelIds.length === 0) {
      console.log("⚠️ No kids channels found");
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      
      console.log(`🔍 Searching for shorts with channelIds:`, channelIds);
      
      // First, let's check if there are ANY shorts with isShort=true
      const testQuery = await databases.listDocuments(
        config.databaseId,
        config.videosCollectionId,
        [Query.equal("isShort", true), Query.limit(5)]
      );
      console.log(`🧪 Test: Found ${testQuery.total} total shorts with isShort=true`);
      if (testQuery.documents.length > 0) {
        console.log(`🧪 Sample short channelIds:`, testQuery.documents.map(d => d.channelId));
      }
      
      let allFetchedShorts: Speech[] = [];
      let offset = 0;
      const batchSize = 100;
      let hasMoreBatches = true;

      while (hasMoreBatches) {
        const queries = [
          Query.equal("isShort", true),
          Query.equal("channelId", channelIds), // This works with array in Appwrite
          Query.isNotNull("videoId"),
          Query.notEqual("videoId", ""),
          Query.limit(batchSize),
          Query.offset(offset),
        ];

        console.log(`🔍 Querying with channelIds:`, channelIds);

        const response = await databases.listDocuments(
          config.databaseId,
          config.videosCollectionId,
          queries
        );

        const batch = response.documents as unknown as Speech[];
        allFetchedShorts = [...allFetchedShorts, ...batch];

        console.log(`📦 Fetched batch: ${batch.length} shorts (total: ${allFetchedShorts.length})`);

        if (batch.length < batchSize) {
          hasMoreBatches = false;
        } else {
          offset += batchSize;
        }
      }

      console.log(`✅ Total kids shorts fetched: ${allFetchedShorts.length}`);
      setAllShorts(allFetchedShorts);
      setError(null);
      
      return allFetchedShorts;
    } catch (err) {
      console.error("Error fetching shorts:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch shorts"));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Build feed with unseen priority
  const buildFeed = useCallback(
    (shorts: Speech[], useSeenIds: string[] = seenShortIds) => {
      if (shorts.length === 0) return [];

      const unseenShorts = shorts.filter(
        (s) => !useSeenIds.includes(s.$id) && !servedShortsRef.current.has(s.$id)
      );
      const seenShorts = shorts.filter(
        (s) => useSeenIds.includes(s.$id) && !servedShortsRef.current.has(s.$id)
      );

      console.log(`📊 Shorts pool: ${unseenShorts.length} unseen, ${seenShorts.length} seen`);

      const shuffledUnseen = shuffleArray(unseenShorts);
      const shuffledSeen = shuffleArray(seenShorts);

      let feed: Speech[] = [];

      // Prioritize unseen
      if (shuffledUnseen.length > 0) {
        feed.push(...shuffledUnseen.slice(0, SHORTS_SERVE_SIZE));
      }

      // Fill with seen if needed
      const remaining = SHORTS_SERVE_SIZE - feed.length;
      if (remaining > 0 && shuffledSeen.length > 0) {
        feed.push(...shuffledSeen.slice(0, remaining));
      }

      // Track served shorts
      feed.forEach((s) => servedShortsRef.current.add(s.$id));

      return shuffleArray(feed);
    },
    [] // Remove seenShortIds from dependencies to prevent rebuilds
  );

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      const channelIds = await fetchKidsChannels();
      const shorts = await fetchAllShorts(channelIds);
      const feed = buildFeed(shorts, initialSeenIdsRef.current);
      setDisplayShorts(feed);
      setHasMore(feed.length === SHORTS_SERVE_SIZE);
    };

    initialize();
  }, [fetchKidsChannels, fetchAllShorts]); // Removed buildFeed from dependencies

  // Load more shorts
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    const nextBatch = buildFeed(allShorts, initialSeenIdsRef.current);
    
    if (nextBatch.length === 0) {
      setHasMore(false);
      return;
    }

    setDisplayShorts((prev) => {
      const existingIds = new Set(prev.map(s => s.$id));
      const uniqueNewShorts = nextBatch.filter(s => !existingIds.has(s.$id));
      return [...prev, ...uniqueNewShorts];
    });
    setHasMore(nextBatch.length === SHORTS_SERVE_SIZE);
  }, [loading, hasMore, allShorts, buildFeed]);

  // Refresh shorts
  const refresh = useCallback(async () => {
    servedShortsRef.current.clear();
    
    const channelIds = await fetchKidsChannels();
    const shorts = await fetchAllShorts(channelIds);
    const feed = buildFeed(shorts, seenShortIds);
    setDisplayShorts(feed);
    setHasMore(feed.length === SHORTS_SERVE_SIZE);
  }, [fetchKidsChannels, fetchAllShorts, buildFeed, seenShortIds]);

  const getStats = useCallback(() => {
    const unseenCount = allShorts.filter((s) => !seenShortIds.includes(s.$id)).length;
    const seenCount = allShorts.filter((s) => seenShortIds.includes(s.$id)).length;
    
    return {
      total: allShorts.length,
      unseen: unseenCount,
      seen: seenCount,
      isExhausted: unseenCount < 5,
    };
  }, [allShorts, seenShortIds]);

  return {
    shorts: displayShorts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    getStats,
  };
}
