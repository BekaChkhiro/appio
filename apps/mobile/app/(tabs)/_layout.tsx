import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBackendSync } from "@/hooks/useBackendSync";

type TabIconProps = {
  color: string;
  size: number;
};

export default function TabsLayout() {
  // Sync Firebase user to backend on login
  useBackendSync();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopColor: "#e5e7eb",
        },
        headerStyle: {
          backgroundColor: "#6366f1",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Create",
          headerTitle: "Appio",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-apps"
        options={{
          title: "My Apps",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Marketplace",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
