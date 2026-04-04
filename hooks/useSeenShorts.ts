import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const SEEN_SHORTS_KEY = "@kids_seen_shorts";

export function useSeenShorts() {
  const [seenShortIds, setSeenShortIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeenShorts();
  }, []);

  const loadSeenShorts = async () => {
    try {
      const stored = await AsyncStorage.getItem(SEEN_SHORTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSeenShortIds(parsed);
      }
    } catch (error) {
      console.error("Failed to load seen shorts:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsSeen = useCallback(async (shortId: string) => {
    try {
      setSeenShortIds((prev) => {
        if (prev.includes(shortId)) return prev;
        const updated = [...prev, shortId];
        AsyncStorage.setItem(SEEN_SHORTS_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Failed to mark short as seen:", error);
    }
  }, []);

  return {
    seenShortIds,
    markAsSeen,
    loading,
  };
}
