import { colors } from "@/constants/theme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { VideoPlayer, VideoSource, VideoView, useVideoPlayer } from "expo-video";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const formatTime = (seconds: number): string => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const CustomVideoPlayer = React.forwardRef<
    VideoPlayer,
    CustomVideoPlayerProps
>(
    (
        {
            videoUrl,
            bottomOffset = 0,
            onTimeUpdate,
            onEnd,
            initialPosition = 0,
            autoPlay = true,
            minimal = false,
            loop = false,
        },
        ref
    ) => {
        const insets = useSafeAreaInsets();
        const [controlsVisible, setControlsVisible] = React.useState(true);
        const [isLoading, setIsLoading] = React.useState(true);
        const [hasError, setHasError] = React.useState(false);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [duration, setDuration] = React.useState(0);
        const [position, setPosition] = React.useState(0);
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
                setPosition(currentTime);
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

        const seekTo = React.useCallback(
            (nextTime: number) => {
                const boundedTime = Math.min(Math.max(nextTime, 0), duration || nextTime);
                player.currentTime = boundedTime;
                setPosition(boundedTime);
                onTimeUpdate?.(boundedTime, duration);
                revealControlsTemporarily();
            },
            [duration, onTimeUpdate, player, revealControlsTemporarily]
        );

        const seekBy = React.useCallback(
            (delta: number) => {
                seekTo(position + delta);
            },
            [position, seekTo]
        );

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
                                    {!minimal && (
                                        <Pressable
                                            onPress={() => seekBy(-10)}
                                            style={styles.secondaryButton}
                                            accessibilityRole="button"
                                            accessibilityLabel="Seek back 10 seconds"
                                        >
                                            <MaterialIcons name="replay-10" size={32} color={colors.text.primary} />
                                        </Pressable>
                                    )}

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

                                    {!minimal && (
                                        <Pressable
                                            onPress={() => seekBy(10)}
                                            style={styles.secondaryButton}
                                            accessibilityRole="button"
                                            accessibilityLabel="Seek forward 10 seconds"
                                        >
                                            <MaterialIcons name="forward-10" size={32} color={colors.text.primary} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View />
                        )}

                        {!minimal && controlsVisible ? (
                            <View
                                style={[
                                    styles.bottomOverlay,
                                    { paddingBottom: Math.max(insets.bottom, 12) + 20 },
                                    bottomOffset > 0 ? { bottom: bottomOffset } : null,
                                ]}
                                pointerEvents="box-none"
                            >
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={Math.max(duration, 0.1)}
                                    value={Math.min(position, duration || position)}
                                    onSlidingStart={clearHideTimer}
                                    onSlidingComplete={seekTo}
                                    minimumTrackTintColor={colors.accent.secondary}
                                    maximumTrackTintColor="rgba(255,255,255,0.35)"
                                    thumbTintColor={colors.accent.secondary}
                                />
                                <View style={styles.timeRow}>
                                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                                    <Text style={styles.timeText}>{duration > 0 ? formatTime(duration) : "--:--"}</Text>
                                </View>
                            </View>
                        ) : null}
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
        gap: 20,
    },
    primaryButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    secondaryButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.42)",
    },
    bottomOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 12,
        paddingTop: 28,
        backgroundColor: "rgba(0, 0, 0, 0.48)",
    },
    slider: {
        width: "100%",
        height: 36,
    },
    timeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: -2,
    },
    timeText: {
        color: colors.text.primary,
        fontSize: 12,
        fontWeight: "500",
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
