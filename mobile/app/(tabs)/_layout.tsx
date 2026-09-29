import { Tabs, router } from "expo-router";
import { Image, Text, View } from "react-native";
import type { ColorValue, ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useT } from "../../ui-strings.ts";

/**
 * Custom gold nav-icon artwork (designer-supplied; the source PNGs'
 * plain white photo-backdrop was trimmed to transparent so they sit
 * correctly on the tab bar in both light and dark theme -- the gold
 * artwork itself is untouched). Rendered as a fixed-size Image, never
 * tinted: unlike the old vector glyphs, this artwork's color is fixed
 * by the source PNG, so the active/inactive distinction below uses
 * opacity instead of a color swap (the label's color still swaps as
 * before).
 */
const NAV_ICONS = {
  home: require("../../assets/icons/navigation-icons_home.png") as ImageSourcePropType,
  divyaDesams: require("../../assets/icons/divya-desams.png") as ImageSourcePropType,
  library: require("../../assets/icons/navigation-icons_library.png") as ImageSourcePropType,
  search: require("../../assets/icons/navigation-icons_search.png") as ImageSourcePropType,
  settings: require("../../assets/icons/navigation-icons_settings.png") as ImageSourcePropType,
};

const ICON_SIZE = 26;
// Reserved for every tab (not just Divya Desams) so the two-line label
// never shifts the bar's icon row relative to the single-line ones.
const LABEL_LINE_HEIGHT = 13;
const LABEL_BOX_HEIGHT = LABEL_LINE_HEIGHT * 2;
const BAR_VERTICAL_PADDING = 6;
const ICON_LABEL_GAP = 2;
// icon + gap + the two-line label box, excluding padding/inset (added
// separately below) -- the default bottom-tabs height heuristic assumes
// a single-line label, so with a reserved two-line label box it clips
// against the bottom safe area (the Android gesture bar / iOS home
// indicator) unless the bar's own height is computed explicitly to
// include both.
const BAR_CONTENT_HEIGHT = ICON_SIZE + ICON_LABEL_GAP + LABEL_BOX_HEIGHT;

function TabIcon({ source, focused }: { source: ImageSourcePropType; focused: boolean }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: ICON_SIZE, height: ICON_SIZE, opacity: focused ? 1 : 0.5 }}
    />
  );
}

const labelTextStyle = (color: ColorValue) =>
  ({ color, fontSize: 11, fontWeight: "500", lineHeight: LABEL_LINE_HEIGHT, textAlign: "center" }) as const;

/**
 * Renders every tab's label with `adjustsFontSizeToFit` so a label
 * shrinks just enough to display in full rather than ellipsizing --
 * `minimumFontScale` caps how far it can shrink so it never goes
 * illegibly small on a narrow device. Every tab reserves the same
 * two-line-tall box (`LABEL_BOX_HEIGHT`), single-line labels centered
 * within it, so the bar's icon row stays level across all five tabs.
 */
function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <View style={{ height: LABEL_BOX_HEIGHT, alignItems: "center", justifyContent: "center" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={labelTextStyle(color)}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Divya Desams' label is always exactly two lines -- split on the
 * label's own first space (not a hardcoded "Divya"/"Desams": the ta/kn/
 * hi translations are each two space-separated words too, so this
 * generalizes across locales without inventing a translated break).
 * The underlying string handed to accessibility/navigation (the route's
 * `title`) is untouched -- this only changes how the label renders.
 */
function TwoLineTabLabel({ color, children }: { color: ColorValue; children: string }) {
  const spaceIndex = children.indexOf(" ");
  if (spaceIndex === -1) return <TabLabel color={color}>{children}</TabLabel>;
  const first = children.slice(0, spaceIndex);
  const second = children.slice(spaceIndex + 1);
  return (
    <View style={{ height: LABEL_BOX_HEIGHT, alignItems: "center", justifyContent: "center" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={labelTextStyle(color)}>
        {first}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={labelTextStyle(color)}>
        {second}
      </Text>
    </View>
  );
}

/**
 * The bottom tab bar: Home, Divya Desams, Library, Search, Settings.
 * Each tab renders the designer's own custom gold icon artwork (see
 * NAV_ICONS above) rather than a vector-icon-library glyph -- restrained
 * on purpose, one antique-gold icon per tab, to keep the
 * "scholarly/spiritual, not SaaS" character from theme.ts intact.
 *
 * The former Knowledge tab was retired: its one real record, the
 * "introduction" article, was moved to live under the Divya Desams tab
 * instead (app/(tabs)/divya-desams/introduction.tsx), since its own
 * content explicitly serves that section rather than a general-purpose
 * category -- mirroring the same move on the web.
 *
 * Single-file tabs (Home, Search, Settings) show their own header here
 * directly (headerShown: true) since they have no nested routes.
 * Directory tabs (Divya Desams, Library) hide the Tab-level header
 * (headerShown: false) and instead let their own nested _layout.tsx (a
 * Stack) render per-screen headers -- this is what lets an index ->
 * detail push show a back button and a changing title while the bottom
 * tab bar stays visible the whole time.
 *
 * Settings (Appearance/Text-size, same controls OnboardingScreen.tsx
 * shows once on first launch) is its own always-available tab, placed
 * last -- not a header button, not a modal.
 *
 * Bug fix: tapping the Library or Divya Desams tab icon while already
 * several screens deep in that tab's own nested Stack (e.g. reading a
 * chapter) did nothing -- React Navigation's bottom-tabs does NOT pop a
 * nested stack to its root on re-tapping the active tab by default,
 * despite that being the platform-conventional behavior (Apple's own
 * apps, e.g. Music/App Store, all pop-to-root on a second tap). Fixed
 * with an explicit `tabPress` listener on each Stack-backed tab below.
 * Two wrong attempts on the way here, both verified empirically rather
 * than assumed: `navigation.popToTop()` (the React Navigation idiom)
 * surfaced an on-screen "action not handled" error, since `navigation`
 * in a Tabs.Screen listener is the TAB navigator's own object and
 * POP_TO_TOP is a stack-only action it doesn't own; `router.navigate`
 * brought the index screen into focus but left older, unrelated stack
 * history reachable via a stray back button, since `navigate` jumps to
 * an existing entry without discarding what's after it.
 * `router.dismissTo`, expo-router's dedicated primitive for exactly
 * this ("go back to this existing screen, discarding everything
 * pushed after it"), is the one that actually gives a clean root
 * screen with no leftover Back button.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        // Explicit height (content height + the bottom safe-area inset,
        // Android's gesture bar / iOS's home indicator): bottom-tabs'
        // own default height assumes a single-line label and clips the
        // two-line Divya Desams label against that inset otherwise.
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: BAR_CONTENT_HEIGHT + BAR_VERTICAL_PADDING * 2 + insets.bottom,
          paddingTop: BAR_VERTICAL_PADDING,
          paddingBottom: BAR_VERTICAL_PADDING + insets.bottom,
        },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        // Explicit, not relying on the default: reported as scrollable
        // content showing through the header with no solid backing --
        // iOS's native header can apply its own translucency absent an
        // explicit opt-out. (bottom-tabs' own header option set has no
        // separate blur-effect control the way native-stack's does --
        // see the nested Stack layouts, divya-desams/_layout.tsx and
        // library/_layout.tsx, for that.)
        headerTransparent: false,
        // Force Icon-over-Label on every tab: bottom-tabs' own default
        // switches to a side-by-side "beside-icon" layout past a width
        // heuristic (e.g. landscape/tablet-ish widths), which would leave
        // no room for Divya Desams' two-line label underneath its icon.
        tabBarLabelPosition: "below-icon",
        tabBarLabel: ({ color, children }) => <TabLabel color={color}>{children}</TabLabel>,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon source={NAV_ICONS.home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="divya-desams"
        options={{
          title: t("tabDivyaDesams"),
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon source={NAV_ICONS.divyaDesams} focused={focused} />,
          tabBarLabel: ({ color, children }) => <TwoLineTabLabel color={color}>{children}</TwoLineTabLabel>,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) router.dismissTo("/divya-desams");
          },
        })}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t("tabLibrary"),
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon source={NAV_ICONS.library} focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) router.dismissTo("/library");
          },
        })}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabSearch"),
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon source={NAV_ICONS.search} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabSettings"),
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon source={NAV_ICONS.settings} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
