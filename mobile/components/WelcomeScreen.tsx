import { useEffect } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { spacing, typography, useTheme } from "../theme";
import welcomeImage from "../../public/images/a0635841-903d-4856-90a8-eca5becb3c5e.png";
import welcomeAudio from "../../public/audio/vy-welcome.mp3";

/**
 * Restores the legacy SAP Build app's real launch screen (page.Page1,
 * "Welcome to Vedanta Yojana") -- title, Sanskrit tagline, the Vedanta
 * Desikan invocation image, and the ambient audio the original page
 * autoplayed on load. Mirrors components/WelcomeGate.tsx on web; shown
 * once ever (see app/_layout.tsx's AsyncStorage gate), before the
 * (tabs) navigator mounts at all -- not a tab, not a modal over it.
 */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  // useAudioPlayer() already releases its native player automatically on
  // unmount -- an explicit player.pause() in an effect cleanup here raced
  // with that disposal under Strict Mode's double-invoke (mount ->
  // cleanup -> mount) and crashed with a native "object already
  // released" error. play() only needs to run once per mount.
  const player = useAudioPlayer(welcomeAudio);

  useEffect(() => {
    // On iOS the welcome audio respects the Ring/Silent switch (the
    // "ambient" session category) and mixes with, not stops, any other
    // audio. Android's behaviour is left exactly as it was.
    if (Platform.OS !== "ios") {
      player.play();
      return;
    }
    let cancelled = false;
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" })
      .catch(() => {
        // Best-effort: if the mode can't be set, still try to play.
      })
      .then(() => {
        if (cancelled) return;
        try {
          player.play();
        } catch {
          // The player may already be released if the screen was dismissed.
        }
      });
    return () => {
      cancelled = true;
    };
  }, [player]);

  function begin() {
    try {
      player.pause();
    } catch {
      // Best-effort: the player may already be released (e.g. a fast
      // double-tap) -- never block dismissing the screen over this.
    }
    onDone();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Image source={welcomeImage} style={styles.image} resizeMode="contain" accessibilityLabel="Swami Vedanta Desikan, with the invocation verse in Sanskrit" />
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>Welcome to Vedanta Yojana</Text>
          <Text style={[styles.tagline, { color: theme.colors.muted }]}>Yatra Jñānam Pravahati</Text>
        </View>
        <View style={styles.buttonBlock}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              begin();
            }}
            style={[styles.button, { backgroundColor: theme.colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Begin"
          >
            <Text style={[styles.buttonLabel, { color: theme.colors.surface }]}>Begin</Text>
          </Pressable>
          {/*
           * UI/UX pass: the button's own label must be immediately legible
           * on first launch, before a reader has any context for Sanskrit
           * transliteration -- "Jñānayātrām Pravartaya" (the original
           * primary label) is preserved here as a caption underneath the
           * button instead of being removed, so the screen keeps its
           * Sanskrit invocation without making the one interactive control
           * on the screen ambiguous.
           */}
          <Text style={[styles.buttonHint, { color: theme.colors.muted }]}>Jñānayātrām Pravartaya</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    padding: spacing.xl,
  },
  image: {
    width: "80%",
    height: "45%",
  },
  textBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
    textAlign: "center",
  },
  tagline: {
    fontSize: typography.small,
    textAlign: "center",
  },
  buttonBlock: {
    alignItems: "center",
    gap: spacing.sm,
  },
  button: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  buttonHint: {
    fontSize: typography.small,
  },
});
