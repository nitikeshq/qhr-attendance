import { Pressable, View } from "react-native";

import { styles, theme } from "../theme";
import { Card, Empty, SectionHeading, Segmented, Text } from "../ui";
import { useState } from "react";

const KIND_COLOUR = {
  birthday_self: theme.warning,
  birthday_team: theme.warning,
  anniversary_self: theme.success,
  anniversary_team: theme.success,
  company_anniversary: theme.primary,
  holiday_announced: theme.danger,
  holiday_reminder: theme.danger,
  event_announced: theme.primary,
  leave_decision: theme.primary,
  wfh_decision: theme.primary,
  reimbursement_decision: theme.primary,
  payslip_published: theme.success,
  asset_assigned: theme.muted,
};

const KIND_LABEL = {
  birthday_self: "Birthday",
  birthday_team: "Birthday",
  anniversary_self: "Anniversary",
  anniversary_team: "Anniversary",
  company_anniversary: "Company",
  holiday_announced: "Holiday",
  holiday_reminder: "Holiday",
  event_announced: "Event",
  leave_decision: "Leave",
  wfh_decision: "WFH",
  reimbursement_decision: "Expense",
  payslip_published: "Payslip",
  asset_assigned: "Asset",
};

function relative(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function InboxScreen({ notifications, unread, loading, markRead, markAll }) {
  const [filter, setFilter] = useState("all");
  const list = filter === "unread" ? notifications.filter((item) => !item.readAt) : notifications;

  return (
    <View>
      <SectionHeading
        title="Notifications"
        caption={unread ? `${unread} unread` : "You are all caught up."}
        right={
          unread ? (
            <Pressable
              accessibilityLabel="Mark all as read"
              disabled={loading}
              onPress={() => void markAll()}
              style={styles.outlineSmallButton}
            >
              <Text style={{ color: theme.primaryDeep, fontSize: 12, fontWeight: "700" }}>Mark all read</Text>
            </Pressable>
          ) : null
        }
      />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `All${notifications.length ? ` (${notifications.length})` : ""}` },
          { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` },
        ]}
      />

      {list.length ? (
        <Card>
          {list.map((item, index) => (
            <Pressable
              key={item._id}
              accessibilityLabel={`${KIND_LABEL[item.kind] || "Update"}: ${item.title}`}
              onPress={() => { if (!item.readAt) void markRead(item); }}
              style={[styles.eventRow, index === list.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View
                style={[
                  styles.eventStripe,
                  { backgroundColor: KIND_COLOUR[item.kind] || theme.primary },
                ]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                {/* Type and time first, so the row is identifiable at a glance. */}
                <Text
                  style={{
                    color: KIND_COLOUR[item.kind] || theme.primary,
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  {KIND_LABEL[item.kind] || "Update"}
                  <Text style={{ color: theme.faint, fontSize: 10, fontWeight: "600" }}>
                    {"  ·  "}{relative(item.createdAt)}
                  </Text>
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ marginTop: 2, fontWeight: item.readAt ? "600" : "700" }}
                >
                  {item.title}
                </Text>
              </View>
              {!item.readAt ? (
                <View style={[styles.dot, { backgroundColor: theme.primary, width: 8, height: 8, marginTop: 6 }]} />
              ) : null}
            </Pressable>
          ))}
        </Card>
      ) : (
        <Empty
          label={filter === "unread" ? "Nothing unread" : "No notifications yet"}
          hint="Birthday wishes, holidays, company events and approval decisions arrive here automatically."
        />
      )}
    </View>
  );
}
