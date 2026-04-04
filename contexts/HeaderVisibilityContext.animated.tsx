import React, { createContext, useCallback, useContext, useRef } from "react";
import { Easing, SharedValue, useSharedValue, withTiming } from "react-native-reanimated";

interface HeaderVisibilityContextType {
    handleScroll: (event: any) => void;
    translateY: SharedValue<number>;
    headerHeight: number;
    showHeader: () => void;
    isScrolledDown: SharedValue<boolean>;
}

const HeaderVisibilityContext = createContext<
    HeaderVisibilityContextType | undefined
>(undefined);

const SCROLL_THRESHOLD = 5;
const HEADER_HEIGHT = 60;
const SCROLL_DOWN_THRESHOLD = 100;

export function HeaderVisibilityProvider({
    children,
    headerHeight = HEADER_HEIGHT,
}: {
    children: React.ReactNode;
    headerHeight?: number;
}) {
    const translateY = useSharedValue(0);
    const isScrolledDown = useSharedValue(false);
    const prevScrollY = useRef(0);
    const lastDirection = useRef<"up" | "down">("up");
    const needsSync = useRef(false);

    const showHeader = useCallback(() => {
        translateY.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.ease),
        });
        lastDirection.current = "up";
        needsSync.current = true;
    }, [translateY]);

    const handleScroll = useCallback(
        (event: any) => {
            const currentScrollY = event.nativeEvent.contentOffset.y;

            isScrolledDown.value = currentScrollY > SCROLL_DOWN_THRESHOLD;

            if (needsSync.current) {
                prevScrollY.current = currentScrollY;
                needsSync.current = false;
            }

            if (currentScrollY <= 0) {
                translateY.value = withTiming(0, {
                    duration: 300,
                    easing: Easing.out(Easing.ease),
                });
                prevScrollY.current = currentScrollY;
                lastDirection.current = "up";
                return;
            }

            const scrollDiff = currentScrollY - prevScrollY.current;

            if (Math.abs(scrollDiff) > SCROLL_THRESHOLD) {
                const newDirection = scrollDiff > 0 ? "down" : "up";

                if (lastDirection.current !== newDirection) {
                    lastDirection.current = newDirection;

                    const targetPosition = newDirection === "down" ? -headerHeight : 0;

                    translateY.value = withTiming(targetPosition, {
                        duration: 300,
                        easing:
                            newDirection === "down"
                                ? Easing.in(Easing.ease)
                                : Easing.out(Easing.ease),
                    });
                }
            }

            prevScrollY.current = currentScrollY;
        },
        [headerHeight, translateY, isScrolledDown],
    );

    return (
        <HeaderVisibilityContext.Provider
            value={{
                handleScroll,
                translateY,
                headerHeight,
                showHeader,
                isScrolledDown,
            }}
        >
            {children}
        </HeaderVisibilityContext.Provider>
    );
}

export function useHeaderVisibility() {
    const context = useContext(HeaderVisibilityContext);
    if (!context) {
        throw new Error(
            "useHeaderVisibility must be used within HeaderVisibilityProvider",
        );
    }
    return context;
}
