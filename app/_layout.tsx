import { AnimatedTabBar } from "@/components/AnimatedTabBar";
import { SimpleHeader } from "@/components/SimpleHeader";
import { colors } from "@/constants/theme";
import {
  HeaderVisibilityProvider,
  useHeaderVisibility,
} from "@/contexts/HeaderVisibilityContext.animated";
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from "@/contexts/TabBarVisibilityContext.animated";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

function RootLayoutContent() {
  const segments = useSegments();
  const { translateY } = useTabBarVisibility();
  const { translateY: headerTranslateY } = useHeaderVisibility();

  // Check if user is on video screen
  const isOnVideoScreen = segments[0] === "video";

  return (
    <>
      {/* Animated Header - Global across all screens except video and shorts */}
      {!isOnVideoScreen && segments[0] !== "shorts" && (
        <SimpleHeader translateY={headerTranslateY} />
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent.secondary,
          tabBarInactiveTintColor: colors.text.secondary,
        }}
        tabBar={(props) => <AnimatedTabBar {...props} translateY={translateY} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="shorts"
          options={{
            title: "Shorts",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "play-circle" : "play-circle-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="video"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeaderVisibilityProvider headerHeight={60}>
          <TabBarVisibilityProvider tabBarHeight={68}>
            <RootLayoutContent />
          </TabBarVisibilityProvider>
        </HeaderVisibilityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
