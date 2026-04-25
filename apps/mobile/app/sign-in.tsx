import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

function navigateAfterSignIn() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (loading) return;
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type !== "success") return; // user cancelled
      const idToken = response.data.idToken;
      if (!idToken) throw new Error("No ID token from Google — check webClientId");
      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
      navigateAfterSignIn();
    } catch (error: any) {
      if (error?.code !== "SIGN_IN_CANCELLED") {
        Alert.alert("Sign-in failed", error?.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (loading) return;
    try {
      setLoading(true);

      // Generate nonce — required to prevent replay attacks.
      // Raw nonce goes to Firebase; SHA-256 hash goes to Apple.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new Error("No identity token from Apple");
      }

      const credential = auth.AppleAuthProvider.credential(
        appleCredential.identityToken,
        rawNonce // unhashed nonce — Firebase hashes it internally to verify
      );
      await auth().signInWithCredential(credential);

      // Apple only sends name on the very first sign-in.
      // Wrap in separate try/catch so a failure here doesn't show "Sign-in failed".
      try {
        const fullName = appleCredential.fullName;
        if (fullName?.givenName) {
          const displayName = [fullName.givenName, fullName.familyName]
            .filter(Boolean)
            .join(" ");
          await auth().currentUser?.updateProfile({ displayName });
        }
      } catch {
        // Non-critical — profile update can be retried later
      }

      navigateAfterSignIn();
    } catch (error: any) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign-in failed", error?.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.skipButton} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color="#6b7280" />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={40} color="#6366f1" />
          </View>
          <Text style={styles.title}>Welcome to Appio</Text>
          <Text style={styles.subtitle}>
            Sign in to create apps, save your projects, and access them from any
            device.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#fff" />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {Platform.OS === "ios" && (
            <Pressable
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  skipButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  hero: {
    alignItems: "center",
    marginBottom: 48,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  buttons: {
    gap: 12,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 14,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  terms: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
});
