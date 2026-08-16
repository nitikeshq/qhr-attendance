import { Pressable, StyleSheet, Text as NativeText, View } from "react-native";

import { appFontFamily, styles, theme } from "./theme";

/**
 * Text wrapper that applies the app font and a computed line height, so type
 * stays legible without repeating lineHeight on every style.
 */
export function Text({ style, ...props }) {
  const flattened = StyleSheet.flatten(style) || {};
  const fontSize = Number(flattened.fontSize) || 15;
  const lineHeight = flattened.lineHeight || Math.ceil(fontSize * 1.4);
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: appFontFamily, fontSize: 15, lineHeight }, style]}
    />
  );
}

export { Icon } from "./icons";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeading({ title, caption, right }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const BADGE_TONE = {
  positive: styles.badgePositive,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  neutral: styles.badgeNeutral,
  info: null,
};

export function toneFor(value) {
  const text = String(value || "").toLowerCase();
  if (["approved", "active", "paid", "present", "resolved", "complete", "done", "cleared"].some((token) => text.includes(token))) return "positive";
  if (["pending", "draft", "review", "progress", "submitted", "late", "partial"].some((token) => text.includes(token))) return "warning";
  if (["reject", "absent", "cancel", "overdue", "failed", "inactive"].some((token) => text.includes(token))) return "danger";
  return "info";
}

export function Badge({ children, tone }) {
  const resolved = tone || toneFor(children);
  return <Text style={[styles.badge, BADGE_TONE[resolved]]}>{String(children || "").replace(/_/g, " ")}</Text>;
}

export function Metric({ label, value, hint }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function Empty({ label, hint }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: theme.text, fontWeight: "700", textAlign: "center" }}>{label}</Text>
      {hint ? <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
