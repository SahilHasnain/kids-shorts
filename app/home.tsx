import EmptyState from "@/components/EmptyState";
import { VideoCard } from "@/components/VideoCard";
import { colors } from "@/constants/theme";
import { useHeaderVisibility } from "@/contexts/HeaderVisibilityContext.animated";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { useKidsVideos } from "@/hooks/useKidsVideos";
import { getProgress } from "@/services/progressTracking";
import { Speech } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface VideoProgress {
    percentage: number;
}

export default function HomeScreen() {
    const router = useRouter();
    const { videos, loading, error, hasMore, loadMore, refresh } = useKidsVideos();
    const [progressData, setProgressData] = useState<Record<string, VideoProgress>>({});

    // Get scroll handlers from contexts
    const { handleScroll: handleTabBarScroll, showTabBar } = useTabBarVisibility();
    const { handleScroll: handleHeaderScroll, showHeader } = useHeaderVisibility();

    // Load progress data
    React.useEffect(() => {
        const loadProgress = async () => {
            const progress: Record<string, VideoProgress> = {};
            for (const video of videos) {
                const videoProgress = await getProgress(video.$id);
                if (videoProgress && videoProgress.progress > 0) {
                    const percentage = (videoProgress.progress / videoProgress.duration) * 100;
                    progress[video.$id] = { percentage };
                }
            }
            setProgressData(progress);
        };
        if (videos.length > 0) {
            loadProgress();
        }
    }, [videos]);

    // Show header and tab bar when screen is focused
    useFocusEffect(
        useCallback(() => {
            showHeader();
            showTabBar();
        }, [showHeader, showTabBar])
    );

    const handleScroll = (event: any) => {
        handleTabBarScroll(event);
        handleHeaderScroll(event);
    };

    const handleVideoPress = (video: Speech) => {
        router.push({
            pathname: "/video",
            params: {
                videoId: video.videoId,
                title: video.title,
                speechId: video.$id,
            },
        });
    };

    const renderVideo = useCallback(
        ({ item }: { item: Speech }) => {
            const progress = progressData[item.$id];
            const progressPercentage = progress ? progress.percentage : undefined;

            return (
                <VideoCard
                    video={item}
                    onPress={() => handleVideoPress(item)}
                    progressPercentage={progressPercentage}
                />
            );
        },
        [progressData]
    );

    const renderFooter = () => {
        if (!loading || videos.length === 0) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.accent.secondary} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading && videos.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={colors.accent.secondary} />
                    <Text style={styles.emptyText}>Loading videos...</Text>
                </View>
            );
        }
        if (error) {
            return (
                <EmptyState
                    message="Unable to load videos. Check your connection."
                    iconName="alert-circle"
                    actionLabel="Retry"
                    onAction={refresh}
                />
            );
        }
        return (
            <EmptyState message="No videos available yet. Check back soon!" iconName="film" />
        );
    };

    return (
        <SafeAreaView edges={[]} style={styles.container}>
            <FlatList
                data={videos}
                renderItem={renderVideo}
                keyExtractor={(item) => item.$id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                onEndReached={() => {
                    if (hasMore && !loading) {
                        loadMore();
                    }
                }}
                onEndReachedThreshold={0.5}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={refresh}
                        colors={[colors.accent.secondary]}
                        tintColor={colors.accent.secondary}
                    />
                }
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    contentContainer: {
        flexGrow: 1,
        paddingTop: 88,
        paddingBottom: 120,
    },
    emptyContainer: {
        height: SCREEN_HEIGHT - 200,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.text.secondary,
    },
    footer: {
        paddingVertical: 20,
        alignItems: "center",
    },
});
