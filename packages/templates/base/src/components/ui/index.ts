// Mobile-native UI component library for Appio agent-generated PWAs.
// Import everything from this barrel: `import { Screen, AppBar, ... } from "./components/ui";`

export { Screen } from "./Screen";
export { AppBar } from "./AppBar";
export { Button } from "./Button";
export { IconButton } from "./IconButton";
export { Card } from "./Card";
export { ListItem } from "./ListItem";
export { FAB } from "./FAB";
export { BottomSheet } from "./BottomSheet";
export { Input, TextArea } from "./Input";
export { SegmentedControl } from "./SegmentedControl";
export { EmptyState } from "./EmptyState";
export { LoginScreen } from "./LoginScreen";
export { PaywallScreen } from "./PaywallScreen";
export type { Plan, Frequency } from "./PaywallScreen";
export { NotificationPermission } from "./NotificationPermission";
export { useAuth } from "./useAuth";
export type { AuthUser, FirebaseConfig, UseAuthReturn } from "./useAuth";
export { useCollection } from "./useFirestore";
export type { FirestoreDoc, QueryFilter, QueryOptions, UseCollectionReturn } from "./useFirestore";
export { TabBar } from "./TabBar";
export { ThemeProvider, useTheme } from "./ThemeProvider";

export {
  PlusIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  HomeIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  HeartIcon,
  StarIcon,
  ClockIcon,
  CalendarIcon,
  BellIcon,
  InboxIcon,
  MenuIcon,
  MoreIcon,
} from "./Icons";
