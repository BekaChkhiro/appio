import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useBackendSync } from "@/hooks/useBackendSync";

const TIER_LABELS: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro Plan",
  creator: "Creator Plan",
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { backendUser } = useBackendSync();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.signInContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#d1d5db" />
          <Text style={styles.signInTitle}>Sign in to Appio</Text>
          <Text style={styles.signInText}>
            Create an account to save your apps and access them anywhere.
          </Text>
          <Pressable
            style={styles.signInButton}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tier = backendUser?.tier ?? "free";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.displayName?.[0]?.toUpperCase() ?? "U"}
          </Text>
        </View>
        <Text style={styles.name}>{user.displayName ?? "User"}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.tier}>{TIER_LABELS[tier] ?? tier}</Text>
      </View>

      <View style={styles.menuSection}>
        <MenuItem icon="settings-outline" label="Settings" />
        <MenuItem icon="help-circle-outline" label="Help & Support" />
        <MenuItem icon="document-text-outline" label="Terms of Service" />
        <MenuItem icon="shield-outline" label="Privacy Policy" />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <Pressable style={styles.menuItem}>
      <Ionicons name={icon as any} size={22} color="#374151" />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  signInContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  signInTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  signInText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  signInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  email: {
    fontSize: 14,
    color: "#6b7280",
  },
  tier: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366f1",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  menuSection: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
  },
});
