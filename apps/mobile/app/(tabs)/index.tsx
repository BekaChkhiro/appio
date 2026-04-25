import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { ChatMessage, useGeneration } from "../../src/hooks/useGeneration";
import { useBuild, type BuildState } from "../../src/hooks/useBuild";
import { api } from "../../src/lib/api";

const TEMPLATE_SUGGESTIONS = [
  {
    id: "todo",
    label: "To-Do List",
    icon: "checkbox-outline" as const,
    prompt: "A simple to-do list app with categories and the ability to mark tasks complete.",
  },
  {
    id: "expense",
    label: "Expense Tracker",
    icon: "wallet-outline" as const,
    prompt: "An expense tracker that lets me log purchases by category and shows a monthly summary chart.",
  },
  {
    id: "notes",
    label: "Notes App",
    icon: "document-text-outline" as const,
    prompt: "A notes app with folders, search, and rich text formatting.",
  },
  {
    id: "quiz",
    label: "Quiz App",
    icon: "help-circle-outline" as const,
    prompt: "A multiple-choice quiz app with a timer and a results screen.",
  },
  {
    id: "habit",
    label: "Habit Tracker",
    icon: "fitness-outline" as const,
    prompt: "A habit tracker with daily check-ins, streaks, and a weekly chart.",
  },
];

export default function CreateScreen() {
  const { messages, isStreaming, canRetry, send, retry } = useGeneration();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    send(text);
    setDraft("");
  };

  const handleSuggestion = (prompt: string) => {
    if (isStreaming) return;
    send(prompt);
  };

  const showEmptyState = messages.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {showEmptyState ? (
          <EmptyState
            disabled={isStreaming}
            onPickSuggestion={handleSuggestion}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {canRetry && (
          <View style={styles.retryBar}>
            <Pressable style={styles.retryButton} onPress={retry}>
              <Ionicons name="refresh" size={16} color="#6366f1" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Describe your app..."
            placeholderTextColor="#9ca3af"
            value={draft}
            onChangeText={setDraft}
            editable={!isStreaming}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            style={[
              styles.sendButton,
              (!draft.trim() || isStreaming) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || isStreaming}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({
  disabled,
  onPickSuggestion,
}: {
  disabled: boolean;
  onPickSuggestion: (prompt: string) => void;
}) {
  return (
    <View style={styles.emptyContent}>
      <Text style={styles.heading}>What app do you want to build?</Text>
      <Text style={styles.subheading}>
        Describe your app idea and AI will build it for you.
      </Text>

      <View style={styles.suggestions}>
        <Text style={styles.suggestionsTitle}>Try something like:</Text>
        {TEMPLATE_SUGGESTIONS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.suggestionChip, disabled && styles.chipDisabled]}
            onPress={() => onPickSuggestion(t.prompt)}
            disabled={disabled}
          >
            <Ionicons name={t.icon} size={18} color="#6366f1" />
            <Text style={styles.suggestionText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <View style={[styles.row, styles.rowRight]}>
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  if (message.role === "status") {
    return (
      <View style={[styles.row, styles.rowLeft]}>
        <View style={styles.statusBubble}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.statusText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  if (message.role === "error") {
    return (
      <View style={[styles.row, styles.rowLeft]}>
        <View style={styles.errorBubble}>
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // Assistant — show the result + preview/build card.
  return (
    <View style={[styles.row, styles.rowLeft]}>
      <View style={styles.assistantContainer}>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{message.text}</Text>
        </View>
        <PreviewCard message={message} />
      </View>
    </View>
  );
}

function PreviewCard({ message }: { message: ChatMessage }) {
  // Each PreviewCard owns its own build lifecycle so multiple cards
  // don't share state or collide with each other.
  const build = useBuild();

  const spec = message.spec ?? {};
  const name = (spec as { name?: string }).name ?? "Untitled";
  const template = (spec as { template?: string }).template ?? "—";
  const theme = (spec as { theme?: { primary?: string } }).theme;
  const primary = theme?.primary ?? "#6366f1";
  const pages = (spec as { pages?: unknown[] }).pages?.length ?? 0;

  const handleBuild = () => {
    if (!message.generationId || !message.spec) return;
    // Use generationId as appId — guaranteed unique per generation.
    build.trigger({
      generationId: message.generationId,
      appId: message.generationId,
      version: 1,
      spec: message.spec,
      templateId: (spec as { template?: string }).template ?? "todo-list",
    });
  };

  const handleInstall = async (publicUrl: string) => {
    // Record install intent on backend (fire-and-forget)
    if (message.generationId) {
      api
        .post(`/apps/${message.generationId}/install`)
        .catch(() => {}); // Non-critical — don't block UX
    }

    // Open the PWA URL in the system browser.
    // On Android Chrome: beforeinstallprompt fires → native install dialog.
    // On iOS Safari: the PWA shows an instruction overlay ("Tap Share → Add to Home Screen").
    try {
      const supported = await Linking.canOpenURL(publicUrl);
      if (supported) {
        await Linking.openURL(publicUrl);
      } else {
        Alert.alert(
          "Cannot Open",
          "Unable to open the browser. Please copy this URL and open it manually:\n\n" +
            publicUrl
        );
      }
    } catch {
      Alert.alert("Error", "Failed to open the browser.");
    }
  };

  const showWebView = build.previewUrl || build.publicUrl;
  const displayUrl = build.publicUrl ?? build.previewUrl;

  return (
    <View style={styles.previewCard}>
      {/* Header row with app info */}
      <View style={styles.previewHeader}>
        <View style={[styles.previewSwatch, { backgroundColor: primary }]}>
          <Text style={styles.previewSwatchText}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.previewBody}>
          <Text style={styles.previewName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.previewMeta}>
            Template: {template} · {pages} {pages === 1 ? "page" : "pages"}
          </Text>
        </View>
      </View>

      {/* WebView preview */}
      {showWebView && displayUrl && (
        <View style={styles.webviewContainer}>
          <WebView
            source={{ uri: displayUrl }}
            style={styles.webview}
            javaScriptEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            )}
            // Preview is visual only — block navigation away from the preview URL.
            onShouldStartLoadWithRequest={(req) =>
              req.url === displayUrl ||
              req.url.startsWith(displayUrl) ||
              req.url === "about:blank"
            }
          />
          {build.previewUrl && !build.publicUrl && (
            <View style={styles.previewLabel}>
              <Text style={styles.previewLabelText}>PREVIEW</Text>
            </View>
          )}
        </View>
      )}

      {/* Build status / actions */}
      {build.isBuilding && (
        <View style={styles.buildStatus}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.buildStatusText}>
            {build.statusMessage ?? "Building..."}
          </Text>
        </View>
      )}

      {build.isError && (
        <View style={styles.buildError}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.buildErrorText}>
            {build.errorMessage ?? "Build failed."}
          </Text>
        </View>
      )}

      {build.isComplete && (
        <View style={styles.buildComplete}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.buildCompleteText}>
            App built successfully!
          </Text>
        </View>
      )}

      {/* Add to Home Screen button (shown after build completes) */}
      {build.isComplete && build.publicUrl && (
        <Pressable
          style={styles.installButton}
          onPress={() => handleInstall(build.publicUrl!)}
        >
          <Ionicons
            name={Platform.OS === "ios" ? "share-outline" : "download-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.installButtonText}>Add to Home Screen</Text>
        </Pressable>
      )}

      {/* Build button (only show when idle) */}
      {build.phase === "idle" && (
        <Pressable style={styles.buildButton} onPress={handleBuild}>
          <Ionicons name="hammer" size={18} color="#fff" />
          <Text style={styles.buildButtonText}>Build App</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  flex: { flex: 1 },

  emptyContent: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 32,
    lineHeight: 24,
  },
  suggestions: { gap: 10 },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipDisabled: { opacity: 0.5 },
  suggestionText: { fontSize: 15, color: "#374151" },

  listContent: {
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  bubble: {
    maxWidth: "85%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 4,
  },
  userText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
  },
  assistantContainer: {
    maxWidth: "90%",
    gap: 8,
  },
  assistantBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderBottomLeftRadius: 4,
  },
  assistantText: {
    color: "#111827",
    fontSize: 15,
    lineHeight: 20,
  },

  statusBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  statusText: {
    color: "#4338ca",
    fontSize: 14,
  },

  errorBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    maxWidth: "85%",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    flexShrink: 1,
  },

  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 10,
  },
  previewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  previewSwatch: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewSwatchText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 20,
  },
  previewBody: { flex: 1, gap: 2 },
  previewName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  previewMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  webviewContainer: {
    height: 360,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  webview: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  previewLabel: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(99, 102, 241, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewLabelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  buildStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  buildStatusText: {
    fontSize: 13,
    color: "#4338ca",
  },
  buildError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  buildErrorText: {
    fontSize: 13,
    color: "#b91c1c",
    flex: 1,
  },
  buildComplete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  buildCompleteText: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "500",
  },
  buildButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    borderRadius: 10,
  },
  buildButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  installButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
  },
  installButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  retryBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: "flex-start",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  retryText: {
    color: "#4338ca",
    fontSize: 14,
    fontWeight: "600",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  inputField: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 22,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: "#6366f1",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#a5b4fc",
  },
});
