import { colors } from "@/constants/theme";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    SharedValue,
    useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SimpleHeaderProps {
    translateY: SharedValue<number>;
}

export function SimpleHeader({ translateY }: SimpleHeaderProps) {
    const insets = useSafeAreaInsets();

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoWrapper}>
                        <Image
                            source={require("@/assets/images/icon.png")}
                            style={styles.logo}
                            contentFit="cover"
                        />
                    </View>
                    <Text style={styles.title}>Kids Shorts</Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    logoContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    logoWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: "hidden",
    },
    logo: {
        width: 32,
        height: 32,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text.primary,
    },
});
