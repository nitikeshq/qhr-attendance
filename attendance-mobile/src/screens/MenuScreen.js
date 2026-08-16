import { Pressable, View } from "react-native";

import { styles, theme } from "../theme";
import { Icon } from "../icons";
import { Card, SectionHeading, Text } from "../ui";

/**
 * The application menu.
 *
 * Everything that did not fit the five-slot tab bar previously lived in a small
 * overflow sheet that showed nothing but a label, so the app's less-used areas
 * were effectively hidden. This is a full menu instead: sections that group work
 * by purpose, an icon and one line of explanation per destination, and the same
 * badge counts the tab bar shows, so a person can see where attention is needed
 * before opening anything.
 */

const GROUPS = [
  {
    title: "My day",
    caption: "Attendance and schedule",
    items: [
      { tab: "Home", icon: "home", caption: "Today at a glance" },
      { tab: "Attendance", icon: "attendance", caption: "Check in, check out, hours worked" },
      { tab: "Calendar", icon: "calendar", caption: "Holidays, events and team dates" },
    ],
  },
  {
    title: "Requests",
    caption: "Ask for time, expenses and help",
    items: [
      { tab: "Requests", icon: "requests", caption: "Leave, work from home, expenses, support" },
      { tab: "Inbox", icon: "inbox", caption: "Decisions and updates for you", badge: "unread" },
    ],
  },
  {
    title: "Work",
    caption: "What is assigned to you",
    items: [{ tab: "Work", icon: "work", caption: "Tasks and projects" }],
  },
  {
    title: "Pay",
    caption: "Salary records",
    items: [{ tab: "Payslips", icon: "payslips", caption: "Payslips, breakdown and PDF download" }],
  },
  {
    title: "Manage",
    caption: "Approvals for your reports",
    managerOnly: true,
    items: [{ tab: "Team", icon: "team", caption: "Attendance, leave, WFH and claims to review", badge: "approvals" }],
  },
];

export default function MenuScreen({
  employee,
  activeTab,
  canApprove,
  unread = 0,
  pendingApprovals = 0,
  onSelect,
  onSignOut,
}) {
  const badgeFor = (key) => (key === "unread" ? unread : key === "approvals" ? pendingApprovals : 0);
  const groups = GROUPS.filter((group) => !group.managerOnly || canApprove);
  const roleLabel = String(employee?.role || "employee").replace(/_/g, " ");

  return (
    <>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={styles.menuAvatar}>
          <Text style={styles.menuAvatarText}>
            {String(employee?.firstName || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }} numberOfLines={1}>
            {employee?.firstName} {employee?.lastName}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {employee?.employeeId ? `${employee.employeeId} · ` : ""}{roleLabel}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {employee?.company?.name || "QHR"}
          </Text>
        </View>
      </Card>

      {groups.map((group) => (
        <View key={group.title} style={{ marginTop: 18 }}>
          <SectionHeading title={group.title} caption={group.caption} />
          <Card style={{ paddingVertical: 4 }}>
            {group.items.map((item, index) => {
              const active = activeTab === item.tab;
              const count = badgeFor(item.badge);
              return (
                <Pressable
                  key={item.tab}
                  accessibilityRole="button"
                  accessibilityLabel={item.tab}
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(item.tab)}
                  style={[styles.menuRow, index === group.items.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.menuIcon, active && styles.menuIconActive]}>
                    <Icon name={item.icon} size={20} color={active ? theme.primaryDeep : theme.muted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.menuLabel, active && { color: theme.primaryDeep }]} numberOfLines={1}>
                      {item.tab}
                    </Text>
                    <Text style={styles.menuCaption} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  </View>
                  {count > 0 ? (
                    <View style={styles.menuCount}>
                      <Text style={styles.menuCountText}>{count > 99 ? "99+" : count}</Text>
                    </View>
                  ) : null}
                  <Icon name="chevronRight" size={16} color={theme.faint} />
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}

      <View style={{ marginTop: 18 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onSignOut}
          style={[styles.secondaryButton, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
        >
          <Icon name="signOut" size={18} color={theme.danger} />
          <Text style={[styles.secondaryText, { color: theme.danger }]}>Sign out</Text>
        </Pressable>
        <Text style={[styles.muted, { textAlign: "center", marginTop: 12 }]}>
          Administrators and HR manage the company from the web console.
        </Text>
      </View>
    </>
  );
}
