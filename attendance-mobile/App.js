import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
} from "react-native";
import { API_ROOT, api } from "./src/api";
import { appFontFamily, styles, theme } from "./src/theme";
import { Badge, Card, Empty, Icon, Metric, Row, SectionHeading, Segmented, Text } from "./src/ui";
import CalendarScreen from "./src/screens/CalendarScreen";
import InboxScreen from "./src/screens/InboxScreen";

const TAB_ICONS = {
  Home: "home",
  Inbox: "requests",
  Attendance: "attendance",
  Requests: "requests",
  Calendar: "calendar",
  Team: "team",
  Work: "work",
  Payslips: "payslips",
};

// Five items fit a phone tab bar comfortably; anything else moves to "More".
const PRIMARY_TAB_LIMIT = 5;
const baseTabs = ["Home", "Attendance", "Requests", "Calendar", "Inbox", "Work", "Payslips"];

/** Calendar window for a given month, which is what the API expects. */
function calendarPath(year, month) {
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return `/calendar?from=${from}&to=${to}`;
}

export default function App() {
  const [token, setToken] = useState("");
  const [employee, setEmployee] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyCode, setCompanyCode] = useState("TESTCO");
  const [employeeId, setEmployeeId] = useState("EMP001");
  const [passcode, setPasscode] = useState("1234");
  const [tab, setTab] = useState("Home");
  const [today, setToday] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [wfhRequests, setWfhRequests] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingWfh, setPendingWfh] = useState([]);
  const [teamGrievances, setTeamGrievances] = useState([]);
  const [teamReimbursements, setTeamReimbursements] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [calendar, setCalendar] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getUTCMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getUTCFullYear());
  const [moreOpen, setMoreOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/auth/companies")
      .then((data) => setCompanies(data.companies || []))
      .catch((error) => setMessage(error.message));
  }, []);

  async function login() {
    setLoading(true);
    setMessage("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ companyCode, employeeId, passcode }),
      });
      const activeToken = data?.accessToken || data?.tokens?.accessToken;
      const activeEmployee = data?.employee;
      if (!activeToken || !activeEmployee || typeof activeEmployee !== "object") {
        throw new Error("The server returned an incomplete login session. Please try again.");
      }

      const unavailable = await refresh(activeToken, activeEmployee);
      setEmployee(activeEmployee);
      setToken(activeToken);
      const employeeName = [activeEmployee.firstName, activeEmployee.lastName]
        .filter(Boolean)
        .join(" ") || activeEmployee.employeeId || "employee";
      setMessage(
        unavailable.length
          ? `Welcome, ${employeeName}. Some sections are temporarily unavailable: ${unavailable.join(", ")}.`
          : `Welcome, ${employeeName}`,
      );
    } catch (error) {
      setToken("");
      setEmployee(null);
      setMessage(error.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh(activeToken = token, activeEmployee = employee) {
    if (!activeToken || !activeEmployee) {
      throw new Error("Your employee session is incomplete. Please sign in again.");
    }

    async function loadModules(modules) {
      const results = await Promise.allSettled(modules.map((module) => module.request));
      const failures = [];
      results.forEach((result, index) => {
        const module = modules[index];
        if (result.status === "fulfilled") {
          module.apply(result.value || {});
        } else {
          failures.push({
            name: module.name,
            error: result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason || "Request failed")),
          });
        }
      });
      return failures;
    }

    const personalModules = [
      {
        name: "attendance",
        request: api("/attendance/today", {}, activeToken),
        apply: (data) => setToday(data.attendance || null),
      },
      {
        name: "leave",
        request: api("/leaves/my", {}, activeToken),
        apply: (data) => setLeaves(data.leaves || []),
      },
      {
        name: "WFH",
        request: api("/wfh/my-requests", {}, activeToken),
        apply: (data) => setWfhRequests(data.wfhRequests || []),
      },
      {
        name: "grievances",
        request: api("/grievances/my-grievances", {}, activeToken),
        apply: (data) => setGrievances(data.grievances || []),
      },
      {
        name: "reimbursements",
        request: api("/reimbursements/my?limit=100", {}, activeToken),
        apply: (data) => setReimbursements(data.reimbursements || []),
      },
      {
        name: "payslips",
        request: api("/payroll/my-payslips", {}, activeToken),
        apply: (data) => setPayslips(data.payslips || []),
      },
      {
        name: "projects",
        request: api("/projects", {}, activeToken),
        apply: (data) => setProjects(data.projects || []),
      },
      {
        name: "tasks",
        request: api("/tasks", {}, activeToken),
        apply: (data) => setTasks(data.tasks || []),
      },
      {
        name: "calendar",
        request: api(calendarPath(calendarYear, calendarMonth), {}, activeToken),
        apply: (data) => setCalendar(data || null),
      },
      {
        name: "notifications",
        request: api("/notifications?limit=50", {}, activeToken),
        apply: (data) => {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread || 0);
        },
      },
    ];
    const failures = await loadModules(personalModules);
    if (failures.length === personalModules.length) {
      throw failures[0].error;
    }

    if (["manager", "hr", "admin"].includes(activeEmployee.role)) {
      failures.push(...await loadModules([
        {
          name: "team attendance",
          request: api("/attendance/team", {}, activeToken),
          apply: (data) => setTeamAttendance(data.attendances || []),
        },
        {
          name: "leave approvals",
          request: api("/leaves/approvals/pending", {}, activeToken),
          apply: (data) => setPendingLeaves(data.leaves || []),
        },
        {
          name: "WFH approvals",
          request: api("/wfh/pending", {}, activeToken),
          apply: (data) => setPendingWfh(data.wfhRequests || []),
        },
        {
          name: "team grievances",
          request: api("/grievances/all", {}, activeToken),
          apply: (data) => setTeamGrievances(data.grievances || []),
        },
        {
          name: "team reimbursements",
          request: api("/reimbursements?limit=100", {}, activeToken),
          apply: (data) => setTeamReimbursements(data.reimbursements || []),
        },
      ]));
    } else {
      setTeamAttendance([]);
      setPendingLeaves([]);
      setPendingWfh([]);
      setTeamGrievances([]);
      setTeamReimbursements([]);
    }

    return failures.map((failure) => failure.name);
  }

  async function logout() {
    if (token)
      await api("/auth/logout", { method: "POST" }, token).catch(
        () => undefined,
      );
    setToken("");
    setEmployee(null);
    setToday(null);
    setLeaves([]);
    setWfhRequests([]);
    setGrievances([]);
    setReimbursements([]);
    setTeamAttendance([]);
    setPendingLeaves([]);
    setPendingWfh([]);
    setTeamGrievances([]);
    setTeamReimbursements([]);
    setPayslips([]);
    setProjects([]);
    setTasks([]);
    setTab("Home");
    setMessage("");
  }

  async function openTab(nextTab) {
    setTab(nextTab);
    setLoading(true);
    try {
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetches one month of calendar events. Kept separate from `refresh` so
   * paging through months does not reload every other module.
   */
  async function loadCalendar(year, month) {
    setLoading(true);
    try {
      const data = await api(calendarPath(year, month), {}, token);
      setCalendar(data || null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function shiftCalendarMonth(step) {
    const next = new Date(Date.UTC(calendarYear, calendarMonth + step, 1));
    const year = next.getUTCFullYear();
    const month = next.getUTCMonth();
    setCalendarYear(year);
    setCalendarMonth(month);
    await loadCalendar(year, month);
  }

  async function goToCalendarToday() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    setCalendarYear(year);
    setCalendarMonth(month);
    await loadCalendar(year, month);
  }

  /** Optimistic: the badge and row update immediately, the call follows. */
  async function markNotificationRead(notification) {
    setNotifications((current) => current.map((item) => (
      item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
    )));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await api(`/notifications/${notification._id}/read`, { method: "PATCH" }, token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await api("/notifications/read-all", { method: "POST" }, token);
      const data = await api("/notifications?limit=50", {}, token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread || 0);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markAttendance(action) {
    setLoading(true);
    setMessage("");
    try {
      let location = null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const result = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        location = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };
      }
      const data = await api(
        `/attendance/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            method: location ? "geofence" : "manual",
            location,
          }),
        },
        token,
      );
      setToday(data.attendance);
      setMessage(data.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyLeave(request = {}) {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const date = request.date || start.toISOString().slice(0, 10);
    setLoading(true);
    setMessage("");
    try {
      const data = await api(
        "/leaves/apply",
        {
          method: "POST",
          body: JSON.stringify({
            leaveType: request.leaveType || "casual",
            startDate: date,
            endDate: date,
            reason: request.reason || "Personal leave requested from mobile",
          }),
        },
        token,
      );
      setMessage(data.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyWfh(request = {}) {
    const start = new Date();
    start.setDate(start.getDate() + 2);
    const date = request.date || start.toISOString().slice(0, 10);
    setLoading(true);
    setMessage("");
    try {
      const data = await api(
        "/wfh",
        {
          method: "POST",
          body: JSON.stringify({
            date,
            reason: request.reason || "Remote work requested from mobile",
            workFromLocation: request.location || "Home",
          }),
        },
        token,
      );
      setMessage(data.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitGrievance(request = {}) {
    setLoading(true);
    setMessage("");
    try {
      const data = await api(
        "/grievances",
        {
          method: "POST",
          body: JSON.stringify({
            category: request.category || "other",
            subject: request.subject || "Workplace support request",
            description:
              request.description ||
              "Please contact me regarding a workplace concern submitted from the mobile portal.",
          }),
        },
        token,
      );
      setMessage(`${data.message} (${data.grievance.ticketNumber})`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitReimbursement(request = {}) {
    setLoading(true);
    setMessage("");
    try {
      const data = await api(
        "/reimbursements",
        {
          method: "POST",
          body: JSON.stringify({
            category: request.category,
            expenseDate: request.expenseDate,
            amount: Number(request.amount),
            description: request.description,
            merchant: request.merchant,
            projectOrCostCenter: request.projectOrCostCenter,
            attachments: [],
          }),
        },
        token,
      );
      if (request.receipt?.uri) {
        const dataBase64 = await FileSystem.readAsStringAsync(request.receipt.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await api(
          `/reimbursements/${data.reimbursement._id}/attachments`,
          {
            method: "POST",
            body: JSON.stringify({
              name: request.receipt.name || "Expense receipt",
              mimeType: request.receipt.mimeType,
              dataBase64,
            }),
          },
          token,
        );
      }
      setMessage(`${data.message}${request.receipt ? " with receipt attached securely" : ""}. It will be paid only after approval.`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function reviewRequest(kind, id, action, amount) {
    setLoading(true);
    setMessage("");
    try {
      const path =
        kind === "leave"
          ? `/leaves/${id}/approve`
          : kind === "wfh"
            ? `/wfh/${id}/review`
            : kind === "reimbursement"
              ? `/reimbursements/${id}/review`
            : `/grievances/${id}/resolve`;
      const data = await api(
        path,
        {
          method: kind === "leave" ? "POST" : "PATCH",
          body: JSON.stringify(
            kind === "grievance"
              ? { resolution: "Resolved from the mobile Team workspace" }
              : kind === "reimbursement"
                ? {
                    action,
                    approvedAmount: action === "approve" ? amount : undefined,
                    paymentMethod: "through_payroll",
                    payrollPeriod: new Date().toISOString().slice(0, 7),
                  }
              : { action },
          ),
        },
        token,
      );
      setMessage(data.message || `${kind} request ${action}d`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token || !employee) {
    return (
      <SafeAreaView style={styles.loginScreen}>
        <StatusBar style="light" backgroundColor={theme.navy} />
        <View style={styles.loginWrap}>
          <View style={styles.brand}>
            <Text style={styles.logo}>Q</Text>
            <View>
              <Text style={styles.brandName}>QHR</Text>
              <Text style={styles.brandMeta}>Attendance</Text>
            </View>
          </View>
          <View style={styles.loginCard}>
            <Text style={styles.label}>Company code</Text>
            <TextInput
              value={companyCode}
              autoCapitalize="characters"
              onChangeText={setCompanyCode}
              style={styles.input}
            />
            <Text style={styles.label}>Employee ID</Text>
            <TextInput
              value={employeeId}
              autoCapitalize="characters"
              onChangeText={setEmployeeId}
              style={styles.input}
            />
            <Text style={styles.label}>Passcode</Text>
            <TextInput
              value={passcode}
              secureTextEntry
              onChangeText={setPasscode}
              style={styles.input}
            />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Pressable
              disabled={loading}
              onPress={login}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Sign in</Text>
              )}
            </Pressable>
            <Text style={styles.helper}>
              {companies.length
                ? `${companies.length} active companies found`
                : `API: ${API_ROOT}`}
            </Text>
          </View>
          <Text style={styles.loginFooter}>
            Administrators and HR sign in through the web console.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canApprove = ["manager", "hr", "admin"].includes(employee?.role);
  const tabs = canApprove
    ? ["Home", "Attendance", "Requests", "Calendar", "Inbox", "Team", "Work", "Payslips"]
    : baseTabs;
  // Keep the tab bar to five items; the rest live in an overflow sheet so
  // targets stay large enough to hit on a phone.
  const visibleTabs = tabs.length > PRIMARY_TAB_LIMIT ? tabs.slice(0, PRIMARY_TAB_LIMIT - 1) : tabs;
  const overflowTabs = tabs.length > PRIMARY_TAB_LIMIT ? tabs.slice(PRIMARY_TAB_LIMIT - 1) : [];
  const pendingApprovals = canApprove
    ? pendingLeaves.length + pendingWfh.length
    : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" backgroundColor={theme.inset} />
      <View style={styles.appBar}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(employee?.firstName || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerIdentity}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {employee?.company?.name || "QHR"}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
            {employee?.firstName} {employee?.lastName}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Refresh"
            disabled={loading}
            onPress={() =>
              void refresh().catch((error) => setMessage(error.message))
            }
            style={styles.headerButton}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Icon name="refresh" size={18} color={theme.primaryDeep} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Sign out"
            onPress={() => void logout()}
            style={styles.headerButton}
          >
            <Text style={styles.logout}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {message ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        ) : null}
        {tab === "Home" && (
          <Home
            employee={employee}
            today={today}
            leaveCount={
              leaves.filter((leave) => leave.status === "pending").length
            }
          />
        )}
        {tab === "Attendance" && (
          <Attendance today={today} loading={loading} mark={markAttendance} />
        )}
        {tab === "Requests" && (
          <Requests
            leaves={leaves}
            wfhRequests={wfhRequests}
            grievances={grievances}
            reimbursements={reimbursements}
            loading={loading}
            applyLeave={applyLeave}
            applyWfh={applyWfh}
            submitGrievance={submitGrievance}
            submitReimbursement={submitReimbursement}
          />
        )}
        {tab === "Team" && canApprove && (
          <Team
            attendance={teamAttendance}
            leaves={pendingLeaves}
            wfhRequests={pendingWfh}
            grievances={teamGrievances}
            reimbursements={teamReimbursements}
            loading={loading}
            review={reviewRequest}
          />
        )}
        {tab === "Calendar" && (
          <CalendarScreen
            calendar={calendar}
            month={calendarMonth}
            year={calendarYear}
            onShiftMonth={(step) => void shiftCalendarMonth(step)}
            onToday={() => void goToCalendarToday()}
          />
        )}
        {tab === "Inbox" && (
          <InboxScreen
            notifications={notifications}
            unread={unreadCount}
            loading={loading}
            markRead={markNotificationRead}
            markAll={markAllNotificationsRead}
          />
        )}
        {tab === "Work" && (
          <Work projects={projects} tasks={tasks} employeeId={employee?._id} />
        )}
        {tab === "Payslips" && <Payslips payslips={payslips} token={token} />}
      </ScrollView>
      {moreOpen ? (
        <Pressable
          accessibilityLabel="Close menu"
          onPress={() => setMoreOpen(false)}
          style={styles.sheetBackdrop}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {overflowTabs.map((item) => {
              const active = tab === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setMoreOpen(false);
                    void openTab(item);
                  }}
                  style={[styles.sheetItem, active && styles.sheetItemActive]}
                >
                  <Icon
                    name={TAB_ICONS[item] || "more"}
                    size={22}
                    color={active ? theme.primaryDeep : theme.muted}
                  />
                  <Text
                    style={[
                      styles.sheetItemText,
                      active && { color: theme.primaryDeep, fontWeight: "700" },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      ) : null}

      <View style={styles.tabs}>
        {visibleTabs.map((item) => {
          const active = tab === item;
          const badge = item === "Team" ? pendingApprovals : item === "Inbox" ? unreadCount : 0;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={item}
              accessibilityState={{ selected: active }}
              onPress={() => void openTab(item)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Icon
                name={TAB_ICONS[item] || "more"}
                size={21}
                color={active ? theme.primaryDeep : theme.faint}
              />
              <Text style={[styles.tabText, active && styles.activeTabText]} numberOfLines={1}>
                {item}
              </Text>
              {badge > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {overflowTabs.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More sections"
            accessibilityState={{ expanded: moreOpen }}
            onPress={() => setMoreOpen((open) => !open)}
            style={[styles.tab, (moreOpen || overflowTabs.includes(tab)) && styles.activeTab]}
          >
            <Icon
              name="more"
              size={21}
              color={moreOpen || overflowTabs.includes(tab) ? theme.primaryDeep : theme.faint}
            />
            <Text
              style={[
                styles.tabText,
                (moreOpen || overflowTabs.includes(tab)) && styles.activeTabText,
              ]}
            >
              More
            </Text>
            {(() => {
              // Surface counts from whichever hidden tabs carry them.
              const hidden = (overflowTabs.includes("Team") ? pendingApprovals : 0)
                + (overflowTabs.includes("Inbox") ? unreadCount : 0);
              return hidden > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{hidden > 9 ? "9+" : hidden}</Text>
                </View>
              ) : null;
            })()}
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Home({ employee, today, leaveCount }) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Today</Text>
        <Text style={styles.heroValue}>
          {today?.checkIn ? "Checked in" : "Ready to check in"}
        </Text>
        <Text style={styles.heroMeta}>
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>
      <View style={styles.grid}>
        <Metric label="Employee ID" value={employee?.employeeId || "-"} />
        <Metric label="Department" value={employee?.department || "-"} />
        <Metric label="Status" value={today?.status || "Not checked in"} />
        <Metric label="Pending leave" value={String(leaveCount)} />
      </View>
    </>
  );
}
function Attendance({ today, loading, mark }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Attendance</Text>
      <Row
        label="Check in"
        value={
          today?.checkIn?.time
            ? new Date(today.checkIn.time).toLocaleTimeString()
            : "-"
        }
      />
      <Row
        label="Check out"
        value={
          today?.checkOut?.time
            ? new Date(today.checkOut.time).toLocaleTimeString()
            : "-"
        }
      />
      <Row
        label="Work duration"
        value={
          today?.workDuration
            ? `${(today.workDuration / 60).toFixed(1)} hours`
            : "-"
        }
      />
      <Pressable
        disabled={loading || Boolean(today?.checkIn)}
        onPress={() => mark("check-in")}
        style={[styles.primaryButton, today?.checkIn && styles.disabled]}
      >
        <Text style={styles.primaryText}>Check in with location</Text>
      </Pressable>
      <Pressable
        disabled={loading || !today?.checkIn || Boolean(today?.checkOut)}
        onPress={() => mark("check-out")}
        style={[
          styles.secondaryButton,
          (!today?.checkIn || today?.checkOut) && styles.disabled,
        ]}
      >
        <Text style={styles.secondaryText}>Check out</Text>
      </Pressable>
    </View>
  );
}
function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
function Requests({
  leaves,
  wfhRequests,
  grievances,
  reimbursements,
  loading,
  applyLeave,
  applyWfh,
  submitGrievance,
  submitReimbursement,
}) {
  const [leaveType, setLeaveType] = useState("casual");
  const [leaveDate, setLeaveDate] = useState(() => futureDate(7));
  const [leaveReason, setLeaveReason] = useState("");
  const [wfhDate, setWfhDate] = useState(() => futureDate(2));
  const [wfhLocation, setWfhLocation] = useState("Home");
  const [wfhReason, setWfhReason] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("travel");
  const [expenseDate, setExpenseDate] = useState(() => futureDate(0));
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseMerchant, setExpenseMerchant] = useState("");
  const [expenseProject, setExpenseProject] = useState("");
  const [receipt, setReceipt] = useState(null);
  async function chooseReceipt() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      Alert.alert("Receipt too large", "Choose a PDF, JPG, or PNG file up to 5 MB.");
      return;
    }
    setReceipt(asset);
  }
  return (
    <>
      <Text style={styles.sectionTitle}>Self-service requests</Text>
      <View style={styles.card}>
        <Text style={styles.formTitle}>Request leave</Text>
        <TextInput
          value={leaveType}
          onChangeText={setLeaveType}
          placeholder="Leave type"
          style={styles.compactInput}
        />
        <TextInput
          value={leaveDate}
          onChangeText={setLeaveDate}
          placeholder="YYYY-MM-DD"
          style={styles.compactInput}
        />
        <TextInput
          value={leaveReason}
          onChangeText={setLeaveReason}
          placeholder="Reason"
          style={styles.compactInput}
        />
        <Pressable
          disabled={loading || !leaveDate || !leaveReason}
          onPress={() =>
            applyLeave({ leaveType, date: leaveDate, reason: leaveReason })
          }
          style={[
            styles.primaryButton,
            (!leaveDate || !leaveReason) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>Submit leave request</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.formTitle}>Request work from home</Text>
        <TextInput
          value={wfhDate}
          onChangeText={setWfhDate}
          placeholder="YYYY-MM-DD"
          style={styles.compactInput}
        />
        <TextInput
          value={wfhLocation}
          onChangeText={setWfhLocation}
          placeholder="Work location"
          style={styles.compactInput}
        />
        <TextInput
          value={wfhReason}
          onChangeText={setWfhReason}
          placeholder="Reason"
          style={styles.compactInput}
        />
        <Pressable
          disabled={loading || !wfhDate || !wfhReason}
          onPress={() =>
            applyWfh({
              date: wfhDate,
              location: wfhLocation,
              reason: wfhReason,
            })
          }
          style={[
            styles.primaryButton,
            (!wfhDate || !wfhReason) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>Submit WFH request</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.formTitle}>Request reimbursement</Text>
        <TextInput value={expenseCategory} onChangeText={setExpenseCategory} placeholder="Category: travel, meals, mobile" style={styles.compactInput} />
        <TextInput value={expenseDate} onChangeText={setExpenseDate} placeholder="Expense date YYYY-MM-DD" style={styles.compactInput} />
        <TextInput value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Claim amount" keyboardType="decimal-pad" style={styles.compactInput} />
        <TextInput value={expenseMerchant} onChangeText={setExpenseMerchant} placeholder="Merchant (optional)" style={styles.compactInput} />
        <TextInput value={expenseProject} onChangeText={setExpenseProject} placeholder="Project or cost center (optional)" style={styles.compactInput} />
        <Pressable onPress={() => void chooseReceipt()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{receipt ? `Receipt: ${receipt.name}` : "Attach PDF, JPG, or PNG receipt (max 5 MB)"}</Text>
        </Pressable>
        <TextInput value={expenseDescription} onChangeText={setExpenseDescription} placeholder="Business purpose and expense details" multiline numberOfLines={3} style={[styles.compactInput, styles.multilineInput]} />
        <Pressable
          disabled={loading || !expenseCategory || !expenseDate || Number(expenseAmount) <= 0 || !expenseDescription}
          onPress={() => submitReimbursement({ category: expenseCategory, expenseDate, amount: expenseAmount, description: expenseDescription, merchant: expenseMerchant, projectOrCostCenter: expenseProject, receipt })}
          style={[styles.primaryButton, (!expenseCategory || !expenseDate || Number(expenseAmount) <= 0 || !expenseDescription) && styles.disabled]}
        >
          <Text style={styles.primaryText}>Submit reimbursement</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.formTitle}>Workplace support</Text>
        <TextInput
          value={supportSubject}
          onChangeText={setSupportSubject}
          placeholder="Subject"
          style={styles.compactInput}
        />
        <TextInput
          value={supportDescription}
          onChangeText={setSupportDescription}
          placeholder="Describe your concern"
          multiline
          numberOfLines={4}
          style={[styles.compactInput, styles.multilineInput]}
        />
        <Pressable
          disabled={loading || !supportSubject || !supportDescription}
          onPress={() =>
            submitGrievance({
              subject: supportSubject,
              description: supportDescription,
            })
          }
          style={[
            styles.secondaryButton,
            (!supportSubject || !supportDescription) && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryText}>Submit support request</Text>
        </Pressable>
      </View>
      <Text style={styles.subheading}>Leave history</Text>
      {leaves.length ? (
        leaves.map((leave) => (
          <View key={leave._id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{leave.leaveType}</Text>
              <Text style={styles.badge}>{leave.status}</Text>
            </View>
            <Text style={styles.muted}>
              {String(leave.startDate).slice(0, 10)} -{" "}
              {String(leave.endDate).slice(0, 10)}
            </Text>
            <Text style={styles.body}>{leave.reason}</Text>
          </View>
        ))
      ) : (
        <Empty label="No leave requests yet" />
      )}
      <Text style={styles.subheading}>WFH history</Text>
      {wfhRequests.length ? (
        wfhRequests.map((request) => (
          <View key={request._id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>
                {String(request.startDate || request.date).slice(0, 10)}
              </Text>
              <Text style={styles.badge}>{request.status}</Text>
            </View>
            <Text style={styles.body}>{request.reason}</Text>
          </View>
        ))
      ) : (
        <Empty label="No WFH requests yet" />
      )}
      <Text style={styles.subheading}>Support history</Text>
      {grievances.length ? (
        grievances.map((grievance) => (
          <View key={grievance._id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{grievance.subject}</Text>
              <Text style={styles.badge}>{grievance.status}</Text>
            </View>
            <Text style={styles.muted}>{grievance.ticketNumber}</Text>
            <Text style={styles.body}>{grievance.description}</Text>
          </View>
        ))
      ) : (
        <Empty label="No support requests yet" />
      )}
      <Text style={styles.subheading}>Reimbursement history</Text>
      {reimbursements.length ? (
        reimbursements.map((claim) => (
          <View key={claim._id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>{claim.claimNumber} - {String(claim.category).replaceAll("_", " ")}</Text>
                <Text style={styles.muted}>{String(claim.expenseDate).slice(0, 10)} - {payslipMoney(claim.amount)}</Text>
              </View>
              <Text style={styles.badge}>{String(claim.status).replaceAll("_", " ")}</Text>
            </View>
            <Text style={styles.body}>{claim.description}</Text>
            {claim.attachments?.length ? <Text style={styles.muted}>{claim.attachments.length} secure receipt{claim.attachments.length === 1 ? "" : "s"} attached</Text> : null}
            {claim.approvedAmount ? <Text style={styles.muted}>Approved: {payslipMoney(claim.approvedAmount)}{claim.payrollPeriod ? ` for ${claim.payrollPeriod}` : ""}</Text> : null}
          </View>
        ))
      ) : (
        <Empty label="No reimbursement requests yet" />
      )}
    </>
  );
}
function Team({
  attendance,
  leaves,
  wfhRequests,
  grievances,
  reimbursements,
  loading,
  review,
}) {
  const openGrievances = grievances.filter(
    (item) => !["resolved", "closed"].includes(item.status),
  );
  return (
    <>
      <Text style={styles.sectionTitle}>My team</Text>
      <View style={styles.grid}>
        <Metric label="Team members" value={String(attendance.length)} />
        <Metric label="Pending leave" value={String(leaves.length)} />
        <Metric label="Pending WFH" value={String(wfhRequests.length)} />
        <Metric label="Open grievances" value={String(openGrievances.length)} />
        <Metric label="Expense claims" value={String(reimbursements.filter((item) => ["pending_manager", "pending_finance"].includes(item.status)).length)} />
      </View>
      <Text style={styles.subheading}>Today&apos;s attendance</Text>
      {attendance.length ? (
        attendance.map((item) => (
          <View key={item.employee._id} style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.cardTitle}>
                  {item.employee.firstName} {item.employee.lastName}
                </Text>
                <Text style={styles.muted}>{item.employee.employeeId}</Text>
              </View>
              <Text style={styles.badge}>
                {item.attendance?.status || "not checked in"}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Empty label="No team members found" />
      )}
      <Text style={styles.subheading}>Leave approvals</Text>
      {leaves.length ? (
        leaves.map((leave) => (
          <View key={leave._id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>
                  {leave.employee.firstName} {leave.employee.lastName}
                </Text>
                <Text style={styles.muted}>
                  {leave.leaveType} - {leave.days} day(s)
                </Text>
              </View>
              <ApprovalButtons
                loading={loading}
                approve={() => review("leave", leave._id, "approve")}
                reject={() => review("leave", leave._id, "reject")}
              />
            </View>
          </View>
        ))
      ) : (
        <Empty label="No leave approvals pending" />
      )}
      <Text style={styles.subheading}>WFH approvals</Text>
      {wfhRequests.length ? (
        wfhRequests.map((request) => (
          <View key={request._id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>
                  {request.employee?.firstName} {request.employee?.lastName}
                </Text>
                <Text style={styles.muted}>
                  {String(request.startDate || request.date).slice(0, 10)}
                </Text>
              </View>
              <ApprovalButtons
                loading={loading}
                approve={() => review("wfh", request._id, "approve")}
                reject={() => review("wfh", request._id, "reject")}
              />
            </View>
          </View>
        ))
      ) : (
        <Empty label="No WFH approvals pending" />
      )}
      <Text style={styles.subheading}>Grievances</Text>
      {openGrievances.length ? (
        openGrievances.map((grievance) => (
          <View key={grievance._id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>{grievance.subject}</Text>
                <Text style={styles.muted}>
                  {grievance.ticketNumber} -{" "}
                  {grievance.employee
                    ? `${grievance.employee.firstName} ${grievance.employee.lastName}`
                    : "Anonymous"}
                </Text>
              </View>
              <Pressable
                disabled={loading}
                onPress={() => review("grievance", grievance._id, "resolve")}
                style={styles.approveButton}
              >
                <Text style={styles.primaryText}>Resolve</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty label="No grievances require attention" />
      )}
      <Text style={styles.subheading}>Reimbursement approvals</Text>
      {reimbursements.filter((item) => ["pending_manager", "pending_finance"].includes(item.status)).length ? (
        reimbursements.filter((item) => ["pending_manager", "pending_finance"].includes(item.status)).map((claim) => (
          <View key={claim._id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>{claim.employee?.firstName} {claim.employee?.lastName}</Text>
                <Text style={styles.muted}>{claim.claimNumber} - {payslipMoney(claim.amount)}</Text>
                <Text style={styles.body}>{claim.description}</Text>
              </View>
              <ApprovalButtons
                loading={loading}
                approve={() => review("reimbursement", claim._id, "approve", claim.amount)}
                reject={() => review("reimbursement", claim._id, "reject", claim.amount)}
              />
            </View>
          </View>
        ))
      ) : (
        <Empty label="No reimbursement approvals pending" />
      )}
    </>
  );
}
function ApprovalButtons({ loading, approve, reject }) {
  return (
    <View style={styles.approvalActions}>
      <Pressable
        disabled={loading}
        onPress={approve}
        style={styles.approveButton}
      >
        <Text style={styles.primaryText}>Approve</Text>
      </Pressable>
      <Pressable
        disabled={loading}
        onPress={reject}
        style={styles.rejectButton}
      >
        <Text style={styles.rejectText}>Reject</Text>
      </Pressable>
    </View>
  );
}
function Work({ projects, tasks, employeeId }) {
  const projectNames = Object.fromEntries(
    projects.map((project) => [project._id, project.name]),
  );
  const assignedTasks = tasks.filter(
    (task) => !task.assignedTo || task.assignedTo === employeeId,
  );
  return (
    <>
      <Text style={styles.sectionTitle}>My work</Text>
      {assignedTasks.length ? (
        assignedTasks.map((task) => (
          <View key={task._id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.badge}>{task.status}</Text>
            </View>
            <Text style={styles.muted}>
              {projectNames[task.projectId] || "No project"} -{" "}
              {task.priority || "medium"} priority
            </Text>
            {task.dueDate ? (
              <Text style={styles.body}>
                Due {String(task.dueDate).slice(0, 10)}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <Empty label="No tasks assigned yet" />
      )}
    </>
  );
}
function payslipMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
function htmlEscape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}
function payslipHtmlBase(item) {
  const employee = item.employee || {};
  const identity = item.settingsSnapshot?.identity || {};
  const allEarnings = item.earnings?.length
    ? item.earnings
    : [
        { name: "Basic salary", amount: item.basic },
        { name: "House rent allowance", amount: item.hra },
        { name: "Legacy allowances", amount: item.allowances },
      ].filter((line) => line.amount);
  const earnings = allEarnings.filter((line) => !line.reimbursement);
  const deductions = item.employeeDeductions?.length
    ? item.employeeDeductions
    : [
        {
          name: "Legacy deductions (detail unavailable)",
          amount: item.deductions,
        },
      ];
  const lines = (items) =>
    items
      .map(
        (line) =>
          `<tr><td>${htmlEscape(line.name)}</td><td class="number">${htmlEscape(payslipMoney(line.amount))}</td></tr>`,
      )
      .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#3d3229}.header{display:flex;justify-content:space-between;border-bottom:3px solid #e07b39;padding-bottom:18px}.right{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:22px 0}.label{font-size:11px;color:#6b625a;text-transform:uppercase}.value{font-weight:700;margin-top:3px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e5e1db;text-align:left}.number{text-align:right}.net{display:flex;justify-content:space-between;background:#fbead8;padding:18px;margin-top:24px;font-size:21px;font-weight:700}.footer{text-align:center;color:#6b625a;font-size:11px;margin-top:25px}</style></head><body><header class="header"><div><h1>${htmlEscape(identity.legalName || item.company?.name || "Company")}</h1><p>${htmlEscape(identity.registeredAddress || "")}</p></div><div class="right"><h2>PAYSLIP</h2><p>${htmlEscape(item.period)}</p><p>${htmlEscape(item.payrollNumber || "")}</p></div></header><section class="grid"><div><div class="label">Employee</div><div class="value">${htmlEscape(`${employee.firstName || ""} ${employee.lastName || ""}`.trim())}</div></div><div><div class="label">Employee ID</div><div class="value">${htmlEscape(employee.employeeId)}</div></div><div><div class="label">Department</div><div class="value">${htmlEscape(employee.department || "")}</div></div><div><div class="label">Payable days</div><div class="value">${htmlEscape(item.attendanceSummary?.payableDays ?? "-")} / ${htmlEscape(item.attendanceSummary?.scheduledDays ?? "-")}</div></div></section><section class="columns"><div><h3>Earnings</h3><table>${lines(earnings)}<tr><th>Gross</th><th class="number">${htmlEscape(payslipMoney(item.gross))}</th></tr></table></div><div><h3>Deductions</h3><table>${lines(deductions)}<tr><th>Total</th><th class="number">${htmlEscape(payslipMoney(item.deductions))}</th></tr></table></div></section><div class="net"><span>Net pay</span><span>${htmlEscape(payslipMoney(item.net))}</span></div><p class="footer">${htmlEscape(identity.payslipFooter || "This is a system-generated payslip.")}</p></body></html>`;
}
function payslipHtml(item) {
  const contributionRows = (item.employerContributions || [])
    .map(
      (line) =>
        `<tr><td>${htmlEscape(line.name)}</td><td class="number">${htmlEscape(payslipMoney(line.amount))}</td></tr>`,
    )
    .join("");
  const employerSection = contributionRows
    ? `<section style="margin-top:22px"><h3>Employer contributions</h3><p style="font-size:11px;color:#6b625a">Company-paid statutory contributions. These amounts do not reduce net pay.</p><table>${contributionRows}<tr><th>Total employer contributions</th><th class="number">${htmlEscape(payslipMoney(item.employerContributionTotal))}</th></tr><tr><th>Company cost for this period</th><th class="number">${htmlEscape(payslipMoney(item.ctcForPeriod || item.gross))}</th></tr></table></section>`
    : "";
  const reimbursementRows = (item.earnings || [])
    .filter((line) => line.reimbursement)
    .map((line) => `<tr><td>${htmlEscape(line.name)}</td><td class="number">${htmlEscape(payslipMoney(line.amount))}</td></tr>`)
    .join("");
  const reimbursementSection = reimbursementRows
    ? `<section style="margin-top:22px"><h3>Reimbursements paid after gross</h3><p style="font-size:11px;color:#6b625a">Approved expense repayments shown separately from salary gross.</p><table>${reimbursementRows}<tr><th>Total reimbursements</th><th class="number">${htmlEscape(payslipMoney(item.reimbursementTotal))}</th></tr></table></section>`
    : "";
  const referenceRows = [
    ...(item.statutoryReference?.employeeDeductions || []).map((line) => ({
      ...line,
      name: `${line.name} (employee)`,
    })),
    ...(item.statutoryReference?.employerContributions || []).map((line) => ({
      ...line,
      name: `${line.name} (employer)`,
    })),
  ]
    .map(
      (line) =>
        `<tr><td>${htmlEscape(line.name)}</td><td class="number">${htmlEscape(payslipMoney(line.amount))}</td></tr>`,
    )
    .join("");
  const referenceSection = referenceRows
    ? `<section style="margin-top:22px"><h3>Current statutory setup reference</h3><p style="font-size:11px;color:#6b625a">${htmlEscape(item.statutoryReference.note)}</p><table>${referenceRows}</table></section>`
    : "";
  const legacyNotice = item.legacyDetailWarning
    ? `<p style="margin-top:18px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px">${htmlEscape(item.legacyDetailWarning)}</p>`
    : "";
  return payslipHtmlBase(item)
    .replace("<h3>Earnings</h3>", "<h3>Earnings and additions</h3>")
    .replace(`<tr><th>Gross</th><th class="number">${htmlEscape(payslipMoney(item.gross))}</th></tr>`, `<tr><th>Gross salary</th><th class="number">${htmlEscape(payslipMoney(item.salaryGross ?? item.gross))}</th></tr>`)
    .replace("<h3>Deductions</h3>", "<h3>Employee deductions</h3>")
    .replace(
      '<div class="net">',
      `${legacyNotice}${reimbursementSection}${employerSection}${referenceSection}<div class="net">`,
    );
}
function Payslips({ payslips, token }) {
  const [expanded, setExpanded] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");
  async function download(item) {
    setDownloading(item._id);
    setDownloadError("");
    let payslipWindow = null;
    try {
      if (Platform.OS === "web") {
        payslipWindow = window.open("about:blank", "_blank", "width=1000,height=900");
        if (!payslipWindow) {
          throw new Error("Please allow pop-ups so the professional payslip can open");
        }
        payslipWindow.document.write(
          "<!doctype html><title>Preparing payslip...</title><body style='font-family:Arial,sans-serif;padding:40px;color:#172033'>Preparing your professional payslip...</body>",
        );
        payslipWindow.document.close();
      }

      const response = await fetch(
        `${API_ROOT}/payroll/my-payslips/${item._id}/download?printVersion=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
      if (!response.ok) throw new Error("Could not download the issued payslip");
      const html = await response.text();
      if (Platform.OS === "web") {
        payslipWindow.document.open();
        payslipWindow.document.write(html);
        payslipWindow.document.close();
        payslipWindow.focus();
        window.setTimeout(() => payslipWindow.print(), 500);
      } else {
        const file = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/pdf",
            dialogTitle: `Payslip ${item.period}`,
            UTI: "com.adobe.pdf",
          });
      }
    } catch (error) {
      if (payslipWindow && !payslipWindow.closed) payslipWindow.close();
      setDownloadError(error.message || "Could not prepare the payslip");
    } finally {
      setDownloading("");
    }
  }
  return (
    <>
      <Text style={styles.sectionTitle}>Payslips</Text>
      {downloadError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{downloadError}</Text>
        </View>
      ) : null}
      {payslips.length ? (
        payslips.map((item) => {
          const isOpen = expanded === item._id;
          const earnings = item.earnings?.length
            ? item.earnings
            : [
                { code: "basic", name: "Basic salary", amount: item.basic },
                {
                  code: "legacy_allowances",
                  name: "Legacy allowances",
                  amount: item.allowances,
                },
              ].filter((line) => line.amount);
          const deductions = item.employeeDeductions?.length
            ? item.employeeDeductions
            : [
                {
                  code: "legacy_deductions",
                  name: "Legacy deductions (detail unavailable)",
                  amount: item.deductions,
                },
              ];
          const reimbursementLines = earnings.filter((line) => line.reimbursement);
          const salaryEarnings = earnings.filter((line) => !line.reimbursement);
          return (
            <View key={item._id} style={styles.card}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : item._id)}
                style={styles.row}
              >
                <View>
                  <Text style={styles.cardTitle}>
                    {new Date(`${item.period}-01T00:00:00`).toLocaleDateString(
                      undefined,
                      { month: "long", year: "numeric" },
                    )}
                  </Text>
                  <Text style={styles.muted}>
                    {item.payrollNumber || "Published payslip"}
                  </Text>
                </View>
                <Text style={styles.badge}>{item.status}</Text>
              </Pressable>
              <View style={styles.payslipNet}>
                <Text style={styles.payslipNetLabel}>Net pay</Text>
                <Text style={styles.payslipNetValue}>
                  {payslipMoney(item.net)}
                </Text>
              </View>
              <View style={styles.payslipSummary}>
                <View style={styles.payslipSummaryItem}>
                  <Text style={styles.muted}>Gross salary</Text>
                  <Text style={styles.summaryValue}>
                    {payslipMoney(item.salaryGross ?? item.gross)}
                  </Text>
                </View>
                <View style={styles.payslipSummaryItem}>
                  <Text style={styles.muted}>Deductions</Text>
                  <Text style={styles.summaryValue}>
                    {payslipMoney(item.deductions)}
                  </Text>
                </View>
              </View>
              {isOpen ? (
                <View style={styles.payslipDetails}>
                  {item.legacyDetailWarning ? (
                    <View style={styles.notice}>
                      <Text style={styles.noticeText}>
                        {item.legacyDetailWarning}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.detailHeading}>Salary earnings</Text>
                  {salaryEarnings.map((line, index) => (
                    <Row
                      key={`${line.code}-${index}`}
                      label={line.name}
                      value={payslipMoney(line.amount)}
                    />
                  ))}
                  {reimbursementLines.length ? <><Text style={styles.detailHeading}>Reimbursements paid after gross</Text>{reimbursementLines.map((line, index) => <Row key={`reimbursement-${line.code}-${index}`} label={line.name} value={payslipMoney(line.amount)} />)}</> : null}
                  <Text style={styles.detailHeading}>Employee deductions</Text>
                  {deductions.map((line, index) => (
                    <Row
                      key={`${line.code}-${index}`}
                      label={line.name}
                      value={payslipMoney(line.amount)}
                    />
                  ))}
                  {item.employerContributions?.length ? (
                    <>
                      <Text style={styles.detailHeading}>
                        Employer contributions
                      </Text>
                      {item.employerContributions.map((line, index) => (
                        <Row
                          key={`${line.code}-${index}`}
                          label={line.name}
                          value={payslipMoney(line.amount)}
                        />
                      ))}
                    </>
                  ) : null}
                  {(item.statutoryDetails || []).length ? (
                    <>
                      <Text style={styles.detailHeading}>
                        Statutory applicability
                      </Text>
                      {(item.statutoryDetails || []).map((detail) => (
                        <Row
                          key={detail.code}
                          label={detail.name}
                          value={
                            !detail.enabled
                              ? "Not enabled"
                              : detail.applicable
                                ? "Applied"
                                : detail.reason || "Not applicable"
                          }
                        />
                      ))}
                    </>
                  ) : null}
                  {item.statutoryReference ? (
                    <>
                      <Text style={styles.detailHeading}>
                        Current statutory setup reference
                      </Text>
                      <Text style={styles.muted}>
                        {item.statutoryReference.note}
                      </Text>
                      {item.statutoryReference.employeeDeductions.map(
                        (line, index) => (
                          <Row
                            key={`reference-employee-${line.code}-${index}`}
                            label={`${line.name} (employee)`}
                            value={payslipMoney(line.amount)}
                          />
                        ),
                      )}
                      {item.statutoryReference.employerContributions.map(
                        (line, index) => (
                          <Row
                            key={`reference-employer-${line.code}-${index}`}
                            label={`${line.name} (employer)`}
                            value={payslipMoney(line.amount)}
                          />
                        ),
                      )}
                    </>
                  ) : null}
                  <Text style={styles.detailHeading}>Attendance</Text>
                  <Row
                    label="Payable days"
                    value={`${item.attendanceSummary?.payableDays ?? "-"} / ${item.attendanceSummary?.scheduledDays ?? "-"}`}
                  />
                  <Row
                    label="Loss of pay days"
                    value={String(item.attendanceSummary?.lossOfPayDays ?? "-")}
                  />
                  {item.yearToDate ? (
                    <>
                      <Text style={styles.detailHeading}>
                        Year to date ({item.yearToDate.taxYear})
                      </Text>
                      <Row
                        label="Gross"
                        value={payslipMoney(item.yearToDate.gross)}
                      />
                      <Row
                        label="Net paid"
                        value={payslipMoney(item.yearToDate.net)}
                      />
                      <Row
                        label="TDS"
                        value={payslipMoney(item.yearToDate.tds)}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.payslipActions}>
                <Pressable
                  onPress={() => setExpanded(isOpen ? null : item._id)}
                  style={styles.compactSecondary}
                >
                  <Text style={styles.secondaryText}>
                    {isOpen ? "Hide details" : "View details"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={downloading === item._id}
                  onPress={() => download(item)}
                  style={styles.compactPrimary}
                >
                  {downloading === item._id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {Platform.OS === "web"
                        ? "Print / save PDF"
                        : "Download PDF"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      ) : (
        <Empty label="No published payslips yet" />
      )}
    </>
  );
}
