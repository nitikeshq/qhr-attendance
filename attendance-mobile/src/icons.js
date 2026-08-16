// Imported from the single family rather than the package barrel, so only the
// Ionicons font ships instead of every family the package carries.
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "./theme";

/**
 * Icon set for the employee app.
 *
 * Icons used to be hand-composed from absolutely positioned Views, which cost
 * roughly 240 lines and still only approximated a clock or a cake. Expo ships
 * `@expo/vector-icons` with the SDK, so no custom native build is needed and the
 * glyphs are real, consistent, and crisp at any size.
 *
 * `name` keeps the app's own vocabulary rather than Ionicons naming, so screens
 * describe what a thing is ("payslips") and the mapping stays in one place.
 */
const GLYPH = {
  // Navigation
  home: "grid-outline",
  attendance: "time-outline",
  requests: "document-text-outline",
  calendar: "calendar-outline",
  team: "people-outline",
  work: "briefcase-outline",
  payslips: "receipt-outline",
  inbox: "notifications-outline",
  menu: "menu-outline",
  more: "ellipsis-horizontal",

  // Actions
  chevronLeft: "chevron-back",
  chevronRight: "chevron-forward",
  chevronDown: "chevron-down",
  close: "close",
  refresh: "refresh",
  check: "checkmark",
  checkCircle: "checkmark-circle",
  signOut: "log-out-outline",
  search: "search-outline",
  filter: "funnel-outline",
  download: "download-outline",
  print: "print-outline",
  add: "add",
  send: "paper-plane-outline",
  attach: "attach-outline",
  edit: "create-outline",

  // Domain
  checkIn: "log-in-outline",
  checkOut: "log-out-outline",
  location: "location-outline",
  wfh: "home-outline",
  leave: "airplane-outline",
  expense: "card-outline",
  support: "help-buoy-outline",
  grievance: "chatbubble-ellipses-outline",
  holiday: "sunny-outline",
  birthday: "gift-outline",
  anniversary: "ribbon-outline",
  company: "business-outline",
  event: "megaphone-outline",
  wallet: "wallet-outline",
  clock: "time-outline",
  info: "information-circle-outline",
  warning: "warning-outline",
  approve: "checkmark-circle-outline",
  reject: "close-circle-outline",
  person: "person-outline",
  shield: "shield-checkmark-outline",
  task: "checkbox-outline",
  project: "folder-open-outline",
};

export function Icon({ name, size = 22, color = theme.faint, style }) {
  return <Ionicons name={GLYPH[name] || GLYPH.info} size={size} color={color} style={style} />;
}

export { GLYPH };
