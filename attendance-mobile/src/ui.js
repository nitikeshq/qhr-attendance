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

/**
 * Icons drawn from plain Views. The app has no icon dependency and adding one
 * would mean a native rebuild, so each glyph is composed from simple shapes.
 * Every icon fills a square box of `size` and inherits `color`.
 */
export function Icon({ name, size = 22, color = theme.faint }) {
  const box = { width: size, height: size, alignItems: "center", justifyContent: "center" };
  const bar = (width, height, extra = {}) => ({
    width,
    height,
    backgroundColor: color,
    borderRadius: Math.min(2, height / 2),
    ...extra,
  });
  const unit = size / 22;

  switch (name) {
    // Four rounded tiles: a dashboard.
    case "home":
      return (
        <View style={[box, { flexDirection: "row", flexWrap: "wrap", gap: 2 * unit }]}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={{
                width: 8 * unit,
                height: 8 * unit,
                borderRadius: 2 * unit,
                backgroundColor: color,
                opacity: index === 0 ? 1 : 0.55,
              }}
            />
          ))}
        </View>
      );
    // A clock: ring plus two hands.
    case "attendance":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.86,
              height: size * 0.86,
              borderRadius: 999,
              borderWidth: Math.max(1.6, 2 * unit),
              borderColor: color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ position: "absolute", top: size * 0.18, width: Math.max(1.6, 2 * unit), height: size * 0.26, backgroundColor: color, borderRadius: 999 }} />
            <View style={{ position: "absolute", width: size * 0.2, height: Math.max(1.6, 2 * unit), backgroundColor: color, borderRadius: 999, left: size * 0.42 }} />
          </View>
        </View>
      );
    // Stacked lines of decreasing width: a form.
    case "requests":
      return (
        <View style={[box, { gap: 3 * unit }]}>
          <View style={bar(size * 0.72, Math.max(2, 2.4 * unit))} />
          <View style={bar(size * 0.72, Math.max(2, 2.4 * unit), { opacity: 0.6 })} />
          <View style={bar(size * 0.44, Math.max(2, 2.4 * unit), { opacity: 0.6 })} />
        </View>
      );
    // A month grid.
    case "calendar":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.84,
              height: size * 0.8,
              borderRadius: 3 * unit,
              borderWidth: Math.max(1.6, 2 * unit),
              borderColor: color,
              paddingTop: 4 * unit,
              alignItems: "center",
              gap: 2 * unit,
            }}
          >
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4 * unit, backgroundColor: color }} />
            <View style={{ flexDirection: "row", gap: 2 * unit, marginTop: 2 * unit }}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={{ width: 3 * unit, height: 3 * unit, borderRadius: 1, backgroundColor: color, opacity: 0.7 }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 2 * unit }}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={{ width: 3 * unit, height: 3 * unit, borderRadius: 1, backgroundColor: color, opacity: 0.7 }} />
              ))}
            </View>
          </View>
        </View>
      );
    // Two overlapping heads.
    case "team":
      return (
        <View style={[box, { flexDirection: "row", alignItems: "flex-end" }]}>
          <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: 999, borderWidth: Math.max(1.6, 2 * unit), borderColor: color, marginRight: -size * 0.1 }} />
          <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: 999, backgroundColor: color, opacity: 0.65 }} />
        </View>
      );
    // Ascending bars: work in progress.
    case "work":
      return (
        <View style={[box, { flexDirection: "row", alignItems: "flex-end", gap: 2.5 * unit }]}>
          <View style={bar(Math.max(2.5, 3.4 * unit), size * 0.34)} />
          <View style={bar(Math.max(2.5, 3.4 * unit), size * 0.56, { opacity: 0.75 })} />
          <View style={bar(Math.max(2.5, 3.4 * unit), size * 0.78, { opacity: 0.55 })} />
        </View>
      );
    // A document with a fold.
    case "payslips":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.66,
              height: size * 0.84,
              borderRadius: 2.5 * unit,
              borderWidth: Math.max(1.6, 2 * unit),
              borderColor: color,
              paddingHorizontal: 3 * unit,
              paddingTop: 5 * unit,
              gap: 2.5 * unit,
            }}
          >
            <View style={bar(size * 0.3, Math.max(1.6, 2 * unit))} />
            <View style={bar(size * 0.22, Math.max(1.6, 2 * unit), { opacity: 0.6 })} />
          </View>
        </View>
      );
    // Three dots: overflow menu.
    case "more":
      return (
        <View style={[box, { flexDirection: "row", gap: 2.5 * unit }]}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={{ width: 4 * unit, height: 4 * unit, borderRadius: 999, backgroundColor: color }} />
          ))}
        </View>
      );
    case "chevronLeft":
    case "chevronRight":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.34,
              height: size * 0.34,
              borderTopWidth: Math.max(1.8, 2.2 * unit),
              borderRightWidth: Math.max(1.8, 2.2 * unit),
              borderColor: color,
              transform: [{ rotate: name === "chevronRight" ? "45deg" : "225deg" }],
            }}
          />
        </View>
      );
    case "refresh":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.74,
              height: size * 0.74,
              borderRadius: 999,
              borderWidth: Math.max(1.8, 2.2 * unit),
              borderColor: color,
              borderRightColor: "transparent",
            }}
          />
        </View>
      );
    // A sun: holiday. Disc with four rays.
    case "holiday":
      return (
        <View style={box}>
          <View style={{ width: size * 0.44, height: size * 0.44, borderRadius: 999, backgroundColor: color }} />
          <View style={{ position: "absolute", top: 0, width: Math.max(1.6, 2 * unit), height: size * 0.16, backgroundColor: color, borderRadius: 999 }} />
          <View style={{ position: "absolute", bottom: 0, width: Math.max(1.6, 2 * unit), height: size * 0.16, backgroundColor: color, borderRadius: 999 }} />
          <View style={{ position: "absolute", left: 0, height: Math.max(1.6, 2 * unit), width: size * 0.16, backgroundColor: color, borderRadius: 999 }} />
          <View style={{ position: "absolute", right: 0, height: Math.max(1.6, 2 * unit), width: size * 0.16, backgroundColor: color, borderRadius: 999 }} />
        </View>
      );
    // A cake: candle over two tiers.
    case "birthday":
      return (
        <View style={[box, { justifyContent: "flex-end", paddingBottom: size * 0.12 }]}>
          <View style={{ position: "absolute", top: size * 0.1, width: Math.max(1.6, 2 * unit), height: size * 0.16, backgroundColor: color, borderRadius: 999 }} />
          <View style={{ width: size * 0.62, height: size * 0.2, borderTopLeftRadius: 3 * unit, borderTopRightRadius: 3 * unit, backgroundColor: color, opacity: 0.6 }} />
          <View style={{ width: size * 0.76, height: size * 0.22, borderRadius: 2 * unit, backgroundColor: color }} />
        </View>
      );
    // An award: disc with two ribbons.
    case "anniversary":
      return (
        <View style={[box, { justifyContent: "flex-start", paddingTop: size * 0.08 }]}>
          <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: 999, borderWidth: Math.max(1.6, 2 * unit), borderColor: color }} />
          <View style={{ flexDirection: "row", gap: 2 * unit, marginTop: 1 * unit }}>
            <View style={{ width: Math.max(1.6, 2.4 * unit), height: size * 0.24, backgroundColor: color, borderRadius: 999 }} />
            <View style={{ width: Math.max(1.6, 2.4 * unit), height: size * 0.24, backgroundColor: color, borderRadius: 999, opacity: 0.6 }} />
          </View>
        </View>
      );
    // A building: two columns of windows.
    case "company":
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.66,
              height: size * 0.78,
              borderRadius: 2 * unit,
              borderWidth: Math.max(1.6, 2 * unit),
              borderColor: color,
              paddingTop: 3 * unit,
              alignItems: "center",
              gap: 2.5 * unit,
            }}
          >
            {[0, 1, 2].map((row) => (
              <View key={row} style={{ flexDirection: "row", gap: 2.5 * unit }}>
                <View style={{ width: 3 * unit, height: 3 * unit, backgroundColor: color, opacity: 0.7 }} />
                <View style={{ width: 3 * unit, height: 3 * unit, backgroundColor: color, opacity: 0.7 }} />
              </View>
            ))}
          </View>
        </View>
      );
    // A tick: confirmation and filter state.
    case "check":
      return (
        <View style={box}>
          <View style={{ position: "absolute", width: size * 0.24, height: Math.max(1.8, 2.2 * unit), backgroundColor: color, borderRadius: 999, transform: [{ rotate: "45deg" }, { translateX: -size * 0.14 }, { translateY: size * 0.1 }] }} />
          <View style={{ position: "absolute", width: size * 0.46, height: Math.max(1.8, 2.2 * unit), backgroundColor: color, borderRadius: 999, transform: [{ rotate: "-45deg" }, { translateX: size * 0.06 }] }} />
        </View>
      );
    default:
      return <View style={[box, { borderRadius: 999, borderWidth: 2, borderColor: color }]} />;
  }
}

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
