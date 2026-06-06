import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from "@expo-google-fonts/baloo-2";
import { StoreProvider } from "@/lib/store";
import { Loading } from "@/components/ui";

export default function RootLayout() {
  // Baloo 2 gives the whole app its rounded, storybook (Duolingo ABC) feel.
  // Loaded at runtime — no native rebuild needed, so it shows in Expo Go too.
  const [fontsLoaded] = useFonts({
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          {fontsLoaded ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#ffffff" },
                animation: "slide_from_right",
              }}
            />
          ) : (
            <Loading />
          )}
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
