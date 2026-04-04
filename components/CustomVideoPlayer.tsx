import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { VideoPlayer, VideoSource, VideoView, useVideoPlayer } from "expo-video";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface CustomVideoPlayerProps {
    videoUrl: string;
    bottomOffset?: number;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onEnd?: () => void;
    initialPosition?: number;
    autoPlay?: boolean;
    minimal?: boolean;
    loop?: boolean;
}

const CONTROL_HIDE_DELAY_MS = 2500;

export const CustomVideoPlayer = React.forwardRef<VideoPlayer, CustomVideoPlayerProps>(
    (
        {
            videoUrl,
            onTimeUpdate,
            onEnd,
            initialPosition = 0,
            autoPlay = true,
            minimal = false,
            loop = false,
        },
        ref
    ) => {
        const [controlsVisible, setControlsVisible] = React.useState(true);
        const [isLoading, setIsLoading] = React.useState(true);
        const [hasError, setHasError] = React.useState(false);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [duration, setDuration] = React.useState(0);
        const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
        const startedAtInitialPositionRef = React.useRef(false);

        const source = React.useMemo<VideoSource>(
            () => ({
                uri: videoUrl,
                useCaching: true,
            }),
            [videoUrl]
        );

        const player = useVideoPlayer(source, (instance) => {
            instance.timeUpdateEventInterval = 0.25;
            instance.staysActiveInBackground = false;
            instance.showNowPlayingNotification = false;
        });

        React.useImperativeHandle(ref, () => player, [player]);

        const clearHideTimer = React.useCallback(() => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        }, []);

        const revealControlsTemporarily = React.useCallback(() => {
            setControlsVisible(true);
            clearHideTimer();
            if (player.playing) {
                hideTimerRef.current = setTimeout(() => {
                    setControlsVisible(false);
                }, CONTROL_HIDE_DELAY_MS);
            }
        }, [clearHideTimer, player]);

        React.useEffect(() => {
            setIsLoading(true);
            setHasError(false);
            setControlsVisible(true);
            startedAtInitialPositionRef.current = false;
        }, [videoUrl]);

        React.useEffect(() => {
            const statusSubscription = player.addListener("statusChange", ({ status, error }) => {
                if (status === "readyToPlay") {
                    setIsLoading(false);
                    const nextDuration = Number.isFinite(player.duration) ? player.duration : 0;
                    if (nextDuration > 0) {
                        setDuration(nextDuration);
                    }
                    if (!startedAtInitialPositionRef.current && initialPosition > 0) {
                        player.currentTime = initialPosition;
                    }
                    startedAtInitialPositionRef.current = true;
                    if (autoPlay) {
                        player.play();
                    }
                } else if (status === "loading") {
                    setIsLoading(true);
                } else if (status === "error") {
                    setIsLoading(false);
                    setHasError(true);
                    console.error("Video error:", error?.message);
                }
            });

            const playingSubscription = player.addListener("playingChange", ({ isPlaying: nextIsPlaying }) => {
                setIsPlaying(nextIsPlaying);
                if (nextIsPlaying) {
                    revealControlsTemporarily();
                } else {
                    clearHideTimer();
                    setControlsVisible(true);
                }
            });

            const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
                const nextDuration = Number.isFinite(player.duration) ? player.duration : 0;
                if (nextDuration > 0 && nextDuration !== duration) {
                    setDuration(nextDuration);
                }
                onTimeUpdate?.(currentTime, nextDuration);
            });

            const endSubscription = player.addListener("playToEnd", () => {
                setControlsVisible(true);
                onEnd?.();

                if (loop) {
                    player.currentTime = 0;
                    player.play();
                }
            });

            return () => {
                statusSubscription.remove();
                playingSubscription.remove();
                timeSubscription.remove();
                endSubscription.remove();
            };
        }, [
            autoPlay,
            clearHideTimer,
            duration,
            initialPosition,
            loop,
            onEnd,
            onTimeUpdate,
            player,
            revealControlsTemporarily,
        ]);

        React.useEffect(() => {
            return () => {
                clearHideTimer();
            };
        }, [clearHideTimer]);

        const handleToggleControls = React.useCallback(() => {
            if (controlsVisible) {
                clearHideTimer();
                setControlsVisible(false);
            } else {
                revealControlsTemporarily();
            }
        }, [clearHideTimer, controlsVisible, revealControlsTemporarily]);

        const togglePlayback = React.useCallback(() => {
            if (player.playing) {
                player.pause();
            } else {
                player.play();
            }
            revealControlsTemporarily();
        }, [player, revealControlsTemporarily]);

        return (
            <View style={styles.container}>
                <VideoView
                    player={player}
                    style={styles.video}
                    nativeControls={false}
                    contentFit="cover"
                    useExoShutter={false}
                    onFirstFrameRender={() => {
                        setIsLoading(false);
                    }}
                />

                {!hasError ? (
                    <View pointerEvents="box-none" style={styles.overlay}>
                        <Pressable
                            style={StyleSheet.absoluteFill}
                            onPress={handleToggleControls}
                            accessibilityRole="button"
                            accessibilityLabel={controlsVisible ? "Hide controls" : "Show controls"}
                        />

                        {controlsVisible ? (
                            <View style={styles.centerControlsWrap} pointerEvents="box-none">
                                <View style={styles.centerControls}>
                                    <Pressable
                                        onPress={togglePlayback}
                                        style={styles.primaryButton}
                                        accessibilityRole="button"
                                        accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
                                    >
                                        <Ionicons
                                            name={isPlaying ? "pause" : "play"}
                                            size={30}
                                            color={colors.text.primary}
                                        />
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View />
                        )}
                    </View>
                ) : null}

                {isLoading && !hasError ? (
                    <View style={styles.loadingContainer} pointerEvents="none">
                        <ActivityIndicator size="large" color={colors.text.primary} />
                        <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                ) : null}

                {hasError ? (
                    <View style={styles.errorContainer} pointerEvents="none">
                        <Text style={styles.errorText}>
                            Unable to load video. Please check your connection.
                        </Text>
                    </View>
                ) : null}
            </View>
        );
    }
);

CustomVideoPlayer.displayName = "CustomVideoPlayer";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    video: {
        flex: 1,
        backgroundColor: "#000",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
        zIndex: 2,
    },
    centerControlsWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    centerControls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: colors.text.secondary,
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
        padding: 20,
    },
    errorText: {
        fontSize: 14,
        color: colors.text.secondary,
        textAlign: "center",
    },
});
