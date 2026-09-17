import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, spacing, typography, useTheme } from "../theme";

/**
 * Reported directly: on a device with a dense enough status bar (many
 * active notification icons -- confirmed via `adb shell dumpsys
 * notification` to be the trigger, not an app bug in isolation), the
 * default native-stack header (library/_layout.tsx, divya-desams/
 * _layout.tsx) overlapped the status bar's clock/icons. That header is
 * rendered natively (react-native-screens), and its status-bar
 * clearance is computed once rather than reactively -- there is no
 * `headerStatusBarHeight` prop on this project's installed
 * @react-navigation/native-stack version to correct it (that prop
 * belongs to the older JS-rendered @react-navigation/stack).
 *
 * This replaces the native header with a JS-rendered one for exactly
 * those two nested Stacks, using useSafeAreaInsets().top -- the same
 * live, reactive safe-area API already used correctly elsewhere in this
 * app (WelcomeScreen.tsx's SafeAreaView) -- so the header always clears
 * whatever the status bar's *current* real height is, not a cached
 * assumption about what it normally is. Tabs-level headers (Home,
 * Search, Settings) never had this problem and are left untouched.
 *
 * `options.headerRight` -- standard React Navigation option, rendered in
 * place of the trailing spacer when a screen supplies one (currently
 * only the chapter reader's bookmark toggle,
 * library/[book]/[chapter].tsx) so the title stays centered whether or
 * not a screen has a right-side action.
 */
export function ScreenHeader({ back, options, navigation }: NativeStackHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={spacing.sm}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text
          style={[styles.title, { color: theme.colors.foreground }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {options.title ?? ""}
        </Text>
        <View style={styles.backButton}>
          {options.headerRight?.({ canGoBack: navigation.canGoBack() })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  backButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: typography.heading,
    fontWeight: "700",
    textAlign: "center",
  },
});
