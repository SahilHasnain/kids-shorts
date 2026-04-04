import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import EmptyState from "@/components/EmptyState";
import { colors } from "@/constants/theme";
import { useKidsShorts } from "@/hooks/useKidsShorts";
import { useSeenShorts } from "@/hooks/useSeenShorts";
import { getProgress, saveProgress } from "@/services/progressTracking";
import { Speech } from "@/types";
import Constants from "expo-constants";
import { VideoPlayer } from "expo-video";
import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ShortItemProps {
  speech: Speech;
  isActive: boolean;
  onWatchProgress: (shortId: string, percentage: number) => void;
}

const ShortItem = React.memo(({ speech, isActive, onWatchProgress }: ShortItemProps) => {
  const videoRef = useRef<VideoPlayer>(null);
  const [initialPosition, setInitialPosition] = React.useState(0);
  const lastSavedProgressRef = React.useRef<number>(0);
  const hasLoadedProgressRef = React.useRef(false);

  const endpoint =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_ENDPOINT ||
    "https://sgp.cloud.appwrite.io/v1";
  const projectId =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID ||
    "69c60b0e001c5ec5e031";
  const videoUrl = `${endpoint}/storage/buckets/video-files/files/${speech.videoId}/view?project=${projectId}`;

  React.useEffect(() => {
    if (hasLoadedProgressRef.current) return;
    hasLoadedProgressRef.current = true;

    const loadProgress = async () => {
      try {
        const progress = await getProgress(speech.$id);
        if (progress && progress.progress > 0) {
          const percentage = (progress.progress / progress.duration) * 100;
          if (percentage >= 5 && percentage <= 95) {
            setInitialPosition(progress.progress);
            lastSavedProgressRef.current = progress.progress;
          }
        }
      } catch (error) {
        console.error("Failed to load progress:", error);
      }
    };
    loadProgress();
  }, [speech.$id]);

  React.useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    if (isActive) {
      player.play();
    } else {
      player.pause();
      if (speech.$id && player.duration > 0) {
        saveProgress(speech.$id, player.currentTime, player.duration).catch(console.error);
      }
    }
  }, [isActive, speech.$id]);

  React.useEffect(() => {
    return () => {
      const player = videoRef.current;
      if (player) {
        player.pause();
        if (speech.$id && player.duration > 0) {
          saveProgress(speech.$id, player.currentTime, player.duration).catch(console.error);
        }
      }
    };
  }, [speech.$id]);

  return (
    <View style={[styles.shortContainer, { height: SCREEN_HEIGHT }]}>
      <CustomVideoPlayer
        ref={videoRef}
        videoUrl={videoUrl}
        bottomOffset={0}
        initialPosition={initialPosition}
        autoPlay={false}
        minimal={true}
        loop={true}
        onTimeUpdate={async (currentTime, duration) => {
          if (isActive && duration > 0) {
            const percentage = (currentTime / duration) * 100;
            onWatchProgress(speech.$id, percentage);

            if (Math.abs(currentTime - lastSavedProgressRef.current) >= 5) {
              await saveProgress(speech.$id, currentTime, duration);
              lastSavedProgressRef.current = currentTime;
            }
          }
        }}
        onEnd={() => {
          if (speech.$id && videoRef.current) {
            onWatchProgress(speech.$id, 100);
            saveProgress(
              speech.$id,
              videoRef.current.duration,
              videoRef.current.duration
            ).catch(console.error);
          }
        }}
      />
    </View>
  );
});

ShortItem.displayName = "ShortItem";

export default function Index() {
  const { seenShortIds, markAsSeen, loading: seenLoading } = useSeenShorts();
  const { shorts, loading, error, hasMore, loadMore, refresh, getStats } = useKidsShorts({
    seenShortIds,
  });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const flatListRef = useRef<FlatList>(null);
  const watchProgressRef = useRef<Map<string, number>>(new Map());

  const handleWatchProgress = useCallback(
    (shortId: string, percentage: number) => {
      watchProgressRef.current.set(shortId, percentage);

      if (percentage >= 80 && !seenShortIds.includes(shortId)) {
        markAsSeen(shortId);
        console.log(`✅ Marked short as seen: ${shortId} (${percentage.toFixed(0)}%)`);
      }
    },
    [markAsSeen, seenShortIds]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setActiveIndex(newIndex);

        if (newIndex > 0) {
          const prevShort = shorts[newIndex - 1];
          if (prevShort) {
            const watchedPercentage = watchProgressRef.current.get(prevShort.$id) || 0;
            if (watchedPercentage >= 80 && !seenShortIds.includes(prevShort.$id)) {
              markAsSeen(prevShort.$id);
            }
          }
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const renderShort = useCallback(
    ({ item, index }: { item: Speech; index: number }) => (
      <ShortItem
        speech={item}
        isActive={index === activeIndex}
        onWatchProgress={handleWatchProgress}
      />
    ),
    [activeIndex, handleWatchProgress]
  );

  const renderFooter = () => {
    if (!loading || shorts.length === 0) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.accent.secondary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if ((loading || seenLoading) && shorts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.accent.secondary} />
          <Text style={styles.emptyText}>Loading shorts...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <EmptyState
          message="Unable to load shorts. Check your connection."
          iconName="alert-circle"
          actionLabel="Retry"
          onAction={refresh}
        />
      );
    }

    const stats = getStats();
    if (stats.isExhausted && shorts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.caughtUpEmoji}>🎉</Text>
          <Text style={styles.caughtUpText}>You're all caught up!</Text>
          <Text style={styles.caughtUpSubtext}>You've seen all available shorts.</Text>
          <Text style={styles.caughtUpSubtext}>Check back later for new content!</Text>
        </View>
      );
    }

    return (
      <EmptyState message="No shorts available yet. Check back soon!" iconName="film" />
    );
  };

  return (
    <SafeAreaView edges={[]} style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={shorts}
        renderItem={renderShort}
        keyExtractor={(item) => item.$id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (hasMore && !loading) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            colors={[colors.accent.secondary]}
            tintColor={colors.accent.secondary}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  shortContainer: {
    width: "100%",
    backgroundColor: "#000",
  },
  emptyContainer: {
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
  caughtUpEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  caughtUpText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  caughtUpSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  footer: {
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
});

