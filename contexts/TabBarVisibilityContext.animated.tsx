import React, { createContext, useCallback, useContext, useRef } from "react";
import { Easing, SharedValue, useSharedValue, withTiming } from "react-native-reanimated";

interface TabBarVisibilityContextType {
    handleScroll: (event: any) => void;
    translateY: SharedValue<number>;
    tabBarHeight: number;
    showTabBar: () => void;
}

const TabBarVisibilityContext = createContext<
    TabBarVisibilityContextType | undefined
>(undefined);

const SCROLL_THRESHOLD = 5;
const TAB_BAR_HEIGHT = 68;

export function TabBarVisibilityProvider({
    children,
    tabBarHeight = TAB_BAR_HEIGHT,
}: {
    children: React.ReactNode;
    tabBarHeight?: number;
}) {
    const translateY = useSharedValue(0);
    const prevScrollY = useRef(0);
    const lastDirection = useRef<"up" | "down">("up");
    const needsSync = useRef(false);

    const showTabBar = useCallback(() => {
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

                    // Hide completely: move down by tab bar height + extra padding to go below system buttons
                    const targetPosition = newDirection === "down" ? tabBarHeight + 50 : 0;

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
        [tabBarHeight, translateY],
    );

    return (
        <TabBarVisibilityContext.Provider
            value={{ handleScroll, translateY, tabBarHeight, showTabBar }}
        >
            {children}
        </TabBarVisibilityContext.Provider>
    );
}

export function useTabBarVisibility() {
    const context = useContext(TabBarVisibilityContext);
    if (!context) {
        throw new Error(
            "useTabBarVisibility must be used within TabBarVisibilityProvider",
        );
    }
    return context;
}
