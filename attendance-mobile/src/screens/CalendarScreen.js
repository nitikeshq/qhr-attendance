import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { styles, theme } from "../theme";
import { Badge, Card, Empty, Icon, Metric, SectionHeading, Segmented, Text } from "../ui";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Every entry type carries its own glyph as well as a colour, so the calendar
 * can be read without learning what the colours mean.
 */
const KIND = {
  holiday: { label: "Holiday", colour: theme.danger, icon: "holiday", tone: "danger" },
  event: { label: "Event", colour: theme.primary, icon: "calendar", tone: "info" },
  birthday: { label: "Birthday", colour: theme.warning, icon: "birthday", tone: "warning" },
  anniversary: { label: "Work anniversary", colour: theme.success, icon: "anniversary", tone: "positive" },
  company_anniversary: { label: "Company", colour: theme.primaryDeep, icon: "company", tone: "info" },
};

const KIND_ORDER = ["holiday", "event", "birthday", "anniversary", "company_anniversary"];

/** The feed can gain kinds server-side, so never index KIND directly. */
function metaFor(kind) {
  return KIND[kind] || { label: "Update", colour: theme.faint, icon: "calendar", tone: "neutral" };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Monday-first 6x7 grid covering the month plus padding days. */
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - offset);
  return Array.from({ length: 42 }, (unused, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const weekday = day.getUTCDay();
    return {
      key: day.toISOString().slice(0, 10),
      day: day.getUTCDate(),
      inMonth: day.getUTCMonth() === month,
      weekend: weekday === 0 || weekday === 6,
    };
  });
}

function formatLong(key) {
  if (!key) return "-";
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function dayDiff(key) {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000);
}

function relative(key) {
  const diff = dayDiff(key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** A plain sentence saying what the entry means. */
function describe(event) {
  if (event.kind === "holiday") {
    return event.paid === false ? "Unpaid holiday, reduces payable days" : "Paid holiday, office closed";
  }
  if (event.kind === "anniversary" && event.years) {
    return `${plural(event.years, "year")} with the company`;
  }
  if (event.kind === "company_anniversary" && event.years) {
    return `${plural(event.years, "year")} since the company was founded`;
  }
  return event.subtitle || metaFor(event.kind).label;
}

function EventRow({ event, last, showDate }) {
  const meta = metaFor(event.kind);
  return (
    <View style={[styles.eventRow, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.eventStripe, { backgroundColor: meta.colour }]} />
      <Icon name={meta.icon} size={18} color={meta.colour} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text style={{ fontWeight: "700" }}>{event.title}</Text>
        <Text style={styles.muted}>{describe(event)}</Text>
        {showDate ? (
          <Text style={[styles.muted, { marginTop: 2 }]}>
            {formatLong(event.date)} · {relative(event.date)}
          </Text>
        ) : null}
      </View>
      <Badge tone={meta.tone}>{meta.label}</Badge>
    </View>
  );
}

export default function CalendarScreen({ calendar, month, year, onShiftMonth, onToday }) {
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(todayKey());
  // Types switched off. Empty means everything is shown.
  const [muted, setMuted] = useState([]);

  const keep = (list) => (list || []).filter((event) => !muted.includes(event.kind));

  const monthEvents = useMemo(() => keep(calendar?.events), [calendar, muted]);
  const upcoming = useMemo(() => keep(calendar?.upcoming), [calendar, muted]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const event of monthEvents) {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [monthEvents]);

  const perKind = useMemo(() => {
    const totals = new Map();
    for (const event of calendar?.events || []) totals.set(event.kind, (totals.get(event.kind) || 0) + 1);
    return totals;
  }, [calendar]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const daySelection = byDay.get(selected) || [];
  const counts = calendar?.counts || {};

  function shiftDay(step) {
    const next = new Date(`${selected}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + step);
    const key = next.toISOString().slice(0, 10);
    setSelected(key);
    if (next.getUTCMonth() !== month || next.getUTCFullYear() !== year) onShiftMonth(step > 0 ? 1 : -1);
  }

  function toggleKind(kind) {
    setMuted((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
  }

  return (
    <View>
      <SectionHeading
        title="Calendar"
        caption="Holidays, company events, birthdays, and work anniversaries."
      />

      <View style={[styles.grid, { marginBottom: 14 }]}>
        <Metric label="Holidays" value={counts.holiday ?? 0} hint="This month" />
        <Metric label="Events" value={counts.event ?? 0} hint="This month" />
        <Metric label="Celebrations" value={(counts.birthday ?? 0) + (counts.anniversary ?? 0)} hint="Birthdays and anniversaries" />
      </View>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "month", label: "Month" },
          { value: "upcoming", label: "Upcoming" },
        ]}
      />

      {/* Type filters double as the legend: each chip shows its glyph, colour,
          and how many entries of that type fall in this month. */}
      <Card>
        <Text style={styles.eyebrow}>Show</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {KIND_ORDER.map((kind) => {
            const meta = metaFor(kind);
            const on = !muted.includes(kind);
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${on ? "Hide" : "Show"} ${meta.label}`}
                onPress={() => toggleKind(kind)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? meta.colour : theme.line,
                  backgroundColor: on ? theme.inset : theme.hover,
                }}
              >
                <Icon name={on ? "check" : meta.icon} size={14} color={on ? meta.colour : theme.faint} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: on ? theme.text : theme.faint }}>
                  {meta.label}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.faint }}>
                  {perKind.get(kind) || 0}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {view === "month" ? (
        <>
          <Card>
            <View style={styles.calendarHead}>
              <Text style={{ fontWeight: "700", fontSize: 15 }}>{monthLabel}</Text>
              <View style={styles.calendarNav}>
                <Pressable
                  accessibilityLabel="Previous month"
                  onPress={() => onShiftMonth(-1)}
                  style={styles.calendarNavButton}
                >
                  <Icon name="chevronLeft" size={18} color={theme.muted} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Go to today"
                  onPress={() => {
                    onToday();
                    setSelected(todayKey());
                  }}
                  style={[styles.calendarNavButton, { paddingHorizontal: 12, minWidth: 60 }]}
                >
                  <Text style={{ color: theme.primaryDeep, fontSize: 12, fontWeight: "700" }}>Today</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Next month"
                  onPress={() => onShiftMonth(1)}
                  style={styles.calendarNavButton}
                >
                  <Icon name="chevronRight" size={18} color={theme.muted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>

            {[0, 1, 2, 3, 4, 5].map((week) => (
              <View key={week} style={styles.weekRow}>
                {grid.slice(week * 7, week * 7 + 7).map((cell) => {
                  const events = byDay.get(cell.key) || [];
                  const isToday = cell.key === todayKey();
                  const isSelected = cell.key === selected;
                  const holiday = events.some((event) => event.kind === "holiday");
                  return (
                    <Pressable
                      key={cell.key}
                      accessibilityLabel={`${formatLong(cell.key)}, ${events.length ? plural(events.length, "entry") : "nothing scheduled"}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelected(cell.key)}
                      style={[
                        styles.dayCell,
                        !cell.inMonth && styles.dayCellOutside,
                        holiday && { backgroundColor: theme.dangerSoft },
                        isSelected && styles.dayCellSelected,
                      ]}
                    >
                      <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{cell.day}</Text>
                      <View style={styles.dotRow}>
                        {events.slice(0, 3).map((event) => (
                          <View key={event._id} style={[styles.dot, { backgroundColor: metaFor(event.kind).colour }]} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Text style={[styles.muted, { marginTop: 10 }]}>
              Tap a day to see everything on it. A red day is a holiday.
            </Text>
          </Card>

          <Card>
            <View style={styles.cardHead}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.eyebrow}>
                    {relative(selected)} · {daySelection.length ? plural(daySelection.length, "entry") : "nothing scheduled"}
                  </Text>
                  <Text style={[styles.cardTitle, { marginTop: 2 }]}>{formatLong(selected)}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable accessibilityLabel="Previous day" onPress={() => shiftDay(-1)} style={styles.calendarNavButton}>
                    <Icon name="chevronLeft" size={16} color={theme.muted} />
                  </Pressable>
                  <Pressable accessibilityLabel="Next day" onPress={() => shiftDay(1)} style={styles.calendarNavButton}>
                    <Icon name="chevronRight" size={16} color={theme.muted} />
                  </Pressable>
                </View>
              </View>
            </View>
            {daySelection.length ? (
              daySelection.map((event, index) => (
                <EventRow key={event._id} event={event} last={index === daySelection.length - 1} />
              ))
            ) : (
              <Empty
                label="Nothing on this day"
                hint={muted.length ? "Some types are switched off above." : "Pick another day to see what is on."}
              />
            )}
          </Card>
        </>
      ) : (
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Coming up</Text>
            <Text style={styles.muted}>The next entries across the company</Text>
          </View>
          {upcoming.length ? (
            upcoming.map((event, index) => (
              <EventRow
                key={`${event._id}-${event.date}`}
                event={event}
                last={index === upcoming.length - 1}
                showDate
              />
            ))
          ) : (
            <Empty
              label="Nothing upcoming"
              hint="Holidays and company events appear here once HR adds them."
            />
          )}
        </Card>
      )}
    </View>
  );
}
