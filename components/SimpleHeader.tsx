import { colors } from "@/constants/theme";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function SimpleHeader() {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 12,
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
