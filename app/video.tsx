import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { colors } from "@/constants/theme";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { getProgress, saveProgress } from "@/services/progressTracking";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { VideoPlayer } from "expo-video";
import React from "react";
import {
    ActivityIndicator,
    AppState,
    StatusBar,
    StyleSheet,
    View
} from "react-native";
import { withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VideoScreen() {
    const params = useLocalSearchParams<{
        videoId: string;
        title?: string;
        channelName?: string;
        thumbnailUrl?: string;
        speechId?: string;
    }>();

    const [isLoading, setIsLoading] = React.useState(true);
    const [videoPlaying, setVideoPlaying] = React.useState(false);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [initialPosition, setInitialPosition] = React.useState(0);
    const lastSavedProgressRef = React.useRef<number>(0);
    const videoRef = React.useRef<VideoPlayer>(null);
    const playingRef = React.useRef(false);
    const speechIdRef = React.useRef<string | undefined>(undefined);
    const videoDurationRef = React.useRef(0);

    const videoId = params.videoId;
    const speechId = params.speechId;

    // Construct Appwrite video URL
    const endpoint = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
    const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "69c60b0e001c5ec5e031";
    const videoUrl = `${endpoint}/storage/buckets/video-files/files/${videoId}/view?project=${projectId}`;

    // Get tab bar visibility context
    const { translateY: tabBarTranslateY, tabBarHeight } = useTabBarVisibility();

    // Hide tab bar when this screen is focused
    useFocusEffect(
        React.useCallback(() => {
            // Hide tab bar by moving it down
            tabBarTranslateY.value = withTiming(tabBarHeight + 50, {
                duration: 300,
            });

            return () => {
                // Show tab bar when leaving
                tabBarTranslateY.value = withTiming(0, {
                    duration: 300,
                });

                const player = videoRef.current;
                if (!player) {
                    return;
                }

                if (player.playing) {
                    player.pause();
                }

                if (speechIdRef.current && videoDurationRef.current > 0) {
                    saveProgress(
                        speechIdRef.current,
                        player.currentTime,
                        videoDurationRef.current,
                    ).catch((error) => {
                        console.error("Error saving progress on blur:", error);
                    });
                }
            };
        }, [tabBarTranslateY, tabBarHeight]),
    );

    React.useEffect(() => {
        playingRef.current = videoPlaying;
    }, [videoPlaying]);

    React.useEffect(() => {
        speechIdRef.current = speechId;
    }, [speechId]);

    React.useEffect(() => {
        videoDurationRef.current = videoDuration;
    }, [videoDuration]);

    React.useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextState) => {
            if (nextState === "active") {
                return;
            }

            const player = videoRef.current;
            if (!player) {
                return;
            }

            if (player.playing) {
                player.pause();
            }

            if (speechIdRef.current && videoDurationRef.current > 0) {
                saveProgress(
                    speechIdRef.current,
                    player.currentTime,
                    videoDurationRef.current,
                ).catch((error) => {
                    console.error("Error saving progress on app background:", error);
                });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Load video on mount and autoplay
    React.useEffect(() => {
        setIsLoading(true);
        setVideoPlaying(true);
        setInitialPosition(0);
        lastSavedProgressRef.current = 0;

        const loadingTimeout = setTimeout(() => {
            setIsLoading(false);
        }, 3000);

        return () => {
            clearTimeout(loadingTimeout);
        };
    }, [videoId]);

    // Load saved progress and resume automatically when applicable
    React.useEffect(() => {
        const loadSavedProgress = async () => {
            if (!speechId) {
                return;
            }

            try {
                const progress = await getProgress(speechId);
                if (progress && progress.progress > 0) {
                    const percentage = (progress.progress / progress.duration) * 100;
                    if (percentage >= 5 && percentage <= 95) {
                        setInitialPosition(progress.progress);
                        lastSavedProgressRef.current = progress.progress;
                        console.log(`Auto-resuming from ${progress.progress}s (${percentage.toFixed(1)}%)`);
                    }
                }
            } catch (error) {
                console.error("Failed to load saved progress:", error);
            }
        };

        loadSavedProgress();
    }, [speechId, videoId]);

    // Cleanup: save progress when screen unmounts
    React.useEffect(() => {
        const player = videoRef.current;
        return () => {
            if (speechId && videoDuration > 0 && player) {
                (async () => {
                    try {
                        await saveProgress(speechId, player.currentTime, videoDuration);
                    } catch (error) {
                        console.error("Error saving progress on unmount:", error);
                    }
                })();
            }
        };
    }, [speechId, videoDuration]);

    return (
        <>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.background.primary}
                translucent
            />

            <SafeAreaView edges={[]} className="flex-1 bg-black">
                <LinearGradient
                    pointerEvents="none"
                    colors={[
                        "rgba(0, 0, 0, 0.46)",
                        "rgba(6, 10, 20, 0.24)",
                        "rgba(0, 0, 0, 0.12)",
                        "rgba(0, 0, 0, 0.36)",
                    ]}
                    locations={[0, 0.18, 0.58, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <View className="flex-1 bg-black">
                    <CustomVideoPlayer
                        ref={videoRef}
                        videoUrl={videoUrl}
                        onTimeUpdate={async (currentTime, duration) => {
                            if (duration > 0 && videoDuration !== duration) {
                                setVideoDuration(duration);
                            }

                            if (
                                speechId &&
                                playingRef.current &&
                                duration > 0 &&
                                Math.abs(currentTime - lastSavedProgressRef.current) >= 10
                            ) {
                                await saveProgress(speechId, currentTime, duration);
                                lastSavedProgressRef.current = currentTime;
                            }
                        }}
                        onEnd={() => {
                            setVideoPlaying(false);

                            if (speechId && videoDuration > 0) {
                                saveProgress(speechId, videoDuration, videoDuration).catch((error) => {
                                    console.error("Error saving progress on end:", error);
                                });
                            }
                        }}
                        initialPosition={initialPosition}
                        autoPlay={true}
                        minimal={false}
                        loop={false}
                    />

                    {isLoading && (
                        <View className="absolute inset-0 items-center justify-center bg-black">
                            <ActivityIndicator
                                size="large"
                                color={colors.text.primary}
                            />
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
}
