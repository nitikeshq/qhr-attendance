import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { API_ROOT, api } from './src/api';

const theme = {
  background: '#F5F0E8',
  inset: '#EBE4D8',
  shadow: '#D4CEC2',
  primary: '#E07B39',
  primaryDark: '#C46A2E',
  primaryDeep: '#A85A28',
  primarySoft: '#FBEAD8',
  text: '#3D3229',
  muted: '#5C4F3D',
  line: '#DDD5C8',
  success: '#2D9B83',
  danger: '#DC2626',
};

const baseTabs = ['Home', 'Attendance', 'Requests', 'Work', 'Payslips'];

export default function App() {
  const [token, setToken] = useState('');
  const [employee, setEmployee] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyCode, setCompanyCode] = useState('TESTCO');
  const [employeeId, setEmployeeId] = useState('EMP001');
  const [passcode, setPasscode] = useState('1234');
  const [tab, setTab] = useState('Home');
  const [today, setToday] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [wfhRequests, setWfhRequests] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingWfh, setPendingWfh] = useState([]);
  const [teamGrievances, setTeamGrievances] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/auth/companies').then((data) => setCompanies(data.companies || [])).catch((error) => setMessage(error.message));
  }, []);

  async function login() {
    setLoading(true); setMessage('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ companyCode, employeeId, passcode }) });
      setToken(data.accessToken); setEmployee(data.employee); setMessage(`Welcome, ${data.employee.name}`);
      await refresh(data.accessToken, data.employee);
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function refresh(activeToken = token, activeEmployee = employee) {
    const [attendance, leaveData, wfhData, grievanceData, payroll, projectData, taskData] = await Promise.all([
      api('/attendance/today', {}, activeToken),
      api('/leaves/my', {}, activeToken),
      api('/wfh/my-requests', {}, activeToken),
      api('/grievances/my-grievances', {}, activeToken),
      api('/payroll/my-payslips', {}, activeToken),
      api('/projects', {}, activeToken),
      api('/tasks', {}, activeToken),
    ]);
    setToday(attendance.attendance); setLeaves(leaveData.leaves || []); setWfhRequests(wfhData.wfhRequests || []); setGrievances(grievanceData.grievances || []); setPayslips(payroll.payslips || []); setProjects(projectData.projects || []); setTasks(taskData.tasks || []);
    if (['manager', 'hr', 'admin'].includes(activeEmployee?.role)) {
      const [teamData, approvalData, wfhApprovalData, grievanceTeamData] = await Promise.all([
        api('/attendance/team', {}, activeToken),
        api('/leaves/approvals/pending', {}, activeToken),
        api('/wfh/pending', {}, activeToken),
        api('/grievances/all', {}, activeToken),
      ]);
      setTeamAttendance(teamData.attendances || []); setPendingLeaves(approvalData.leaves || []); setPendingWfh(wfhApprovalData.wfhRequests || []); setTeamGrievances(grievanceTeamData.grievances || []);
    } else {
      setTeamAttendance([]); setPendingLeaves([]); setPendingWfh([]); setTeamGrievances([]);
    }
  }

  async function logout() {
    if (token) await api('/auth/logout', { method: 'POST' }, token).catch(() => undefined);
    setToken(''); setEmployee(null); setToday(null); setLeaves([]); setWfhRequests([]); setGrievances([]); setTeamAttendance([]); setPendingLeaves([]); setPendingWfh([]); setTeamGrievances([]); setPayslips([]); setProjects([]); setTasks([]); setTab('Home'); setMessage('');
  }

  async function openTab(nextTab) {
    setTab(nextTab);
    setLoading(true);
    try { await refresh(); } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function markAttendance(action) {
    setLoading(true); setMessage('');
    try {
      let location = null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
      }
      const data = await api(`/attendance/${action}`, { method: 'POST', body: JSON.stringify({ method: location ? 'geofence' : 'manual', location }) }, token);
      setToday(data.attendance); setMessage(data.message); await refresh();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function applyLeave(request = {}) {
    const start = new Date(); start.setDate(start.getDate() + 7);
    const date = request.date || start.toISOString().slice(0, 10);
    setLoading(true); setMessage('');
    try {
      const data = await api('/leaves/apply', { method: 'POST', body: JSON.stringify({ leaveType: request.leaveType || 'casual', startDate: date, endDate: date, reason: request.reason || 'Personal leave requested from mobile' }) }, token);
      setMessage(data.message); await refresh();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function applyWfh(request = {}) {
    const start = new Date(); start.setDate(start.getDate() + 2);
    const date = request.date || start.toISOString().slice(0, 10);
    setLoading(true); setMessage('');
    try {
      const data = await api('/wfh', { method: 'POST', body: JSON.stringify({ date, reason: request.reason || 'Remote work requested from mobile', workFromLocation: request.location || 'Home' }) }, token);
      setMessage(data.message); await refresh();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function submitGrievance(request = {}) {
    setLoading(true); setMessage('');
    try {
      const data = await api('/grievances', { method: 'POST', body: JSON.stringify({ category: request.category || 'other', subject: request.subject || 'Workplace support request', description: request.description || 'Please contact me regarding a workplace concern submitted from the mobile portal.' }) }, token);
      setMessage(`${data.message} (${data.grievance.ticketNumber})`); await refresh();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function reviewRequest(kind, id, action) {
    setLoading(true); setMessage('');
    try {
      const path = kind === 'leave' ? `/leaves/${id}/approve` : kind === 'wfh' ? `/wfh/${id}/review` : `/grievances/${id}/resolve`;
      const data = await api(path, { method: kind === 'leave' ? 'POST' : 'PATCH', body: JSON.stringify(kind === 'grievance' ? { resolution: 'Resolved from the mobile Team workspace' } : { action }) }, token);
      setMessage(data.message || `${kind} request ${action}d`); await refresh();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  if (!token) {
    return <SafeAreaView style={styles.screen}><StatusBar style="dark" backgroundColor={theme.background} /><View style={styles.loginWrap}><View style={styles.brand}><Text style={styles.logo}>Q</Text><View><Text style={styles.title}>QHR Attendance</Text><Text style={styles.muted}>Employee mobile portal</Text></View></View><View style={styles.card}><Text style={styles.label}>Company code</Text><TextInput value={companyCode} autoCapitalize="characters" onChangeText={setCompanyCode} style={styles.input} /><Text style={styles.label}>Employee ID</Text><TextInput value={employeeId} autoCapitalize="characters" onChangeText={setEmployeeId} style={styles.input} /><Text style={styles.label}>Passcode</Text><TextInput value={passcode} secureTextEntry onChangeText={setPasscode} style={styles.input} />{message ? <Text style={styles.error}>{message}</Text> : null}<Pressable disabled={loading} onPress={login} style={styles.primaryButton}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable><Text style={styles.helper}>{companies.length ? `${companies.length} active companies found` : `API: ${API_ROOT}`}</Text></View></View></SafeAreaView>;
  }

  const canApprove = ['manager', 'hr', 'admin'].includes(employee?.role);
  const tabs = canApprove ? ['Home', 'Attendance', 'Requests', 'Team', 'Work', 'Payslips'] : baseTabs;
  return <SafeAreaView style={styles.screen}><StatusBar style="dark" backgroundColor={theme.background} /><View style={styles.header}><View style={styles.headerIdentity}><Text style={styles.eyebrow}>{employee?.company?.name}</Text><Text style={styles.title} numberOfLines={1}>Hello, {employee?.firstName}</Text><Text style={styles.roleText}>{String(employee?.role || 'employee').replace('_', ' ')}</Text></View><View style={styles.headerActions}><Pressable disabled={loading} onPress={() => void refresh().catch((error) => setMessage(error.message))} style={styles.headerButton}><Text style={styles.refresh}>Refresh</Text></Pressable><Pressable onPress={() => void logout()} style={styles.headerButton}><Text style={styles.logout}>Logout</Text></Pressable></View></View><ScrollView contentContainerStyle={styles.content}>{message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}{tab === 'Home' && <Home employee={employee} today={today} leaveCount={leaves.filter((leave) => leave.status === 'pending').length} />}{tab === 'Attendance' && <Attendance today={today} loading={loading} mark={markAttendance} />}{tab === 'Requests' && <Requests leaves={leaves} wfhRequests={wfhRequests} grievances={grievances} loading={loading} applyLeave={applyLeave} applyWfh={applyWfh} submitGrievance={submitGrievance} />}{tab === 'Team' && canApprove && <Team attendance={teamAttendance} leaves={pendingLeaves} wfhRequests={pendingWfh} grievances={teamGrievances} loading={loading} review={reviewRequest} />}{tab === 'Work' && <Work projects={projects} tasks={tasks} employeeId={employee?._id} />}{tab === 'Payslips' && <Payslips payslips={payslips} />}</ScrollView><View style={styles.tabs}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>{tabs.map((item) => <Pressable key={item} onPress={() => void openTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text></Pressable>)}</ScrollView></View></SafeAreaView>;
}

function Home({ employee, today, leaveCount }) { return <><View style={styles.hero}><Text style={styles.heroLabel}>Today</Text><Text style={styles.heroValue}>{today?.checkIn ? 'Checked in' : 'Ready to check in'}</Text><Text style={styles.heroMeta}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><View style={styles.grid}><Metric label="Employee ID" value={employee.employeeId} /><Metric label="Department" value={employee.department} /><Metric label="Status" value={today?.status || 'Not checked in'} /><Metric label="Pending leave" value={String(leaveCount)} /></View></> }
function Attendance({ today, loading, mark }) { return <View style={styles.card}><Text style={styles.sectionTitle}>Attendance</Text><Row label="Check in" value={today?.checkIn?.time ? new Date(today.checkIn.time).toLocaleTimeString() : '-'} /><Row label="Check out" value={today?.checkOut?.time ? new Date(today.checkOut.time).toLocaleTimeString() : '-'} /><Row label="Work duration" value={today?.workDuration ? `${(today.workDuration / 60).toFixed(1)} hours` : '-'} /><Pressable disabled={loading || Boolean(today?.checkIn)} onPress={() => mark('check-in')} style={[styles.primaryButton, today?.checkIn && styles.disabled]}><Text style={styles.primaryText}>Check in with location</Text></Pressable><Pressable disabled={loading || !today?.checkIn || Boolean(today?.checkOut)} onPress={() => mark('check-out')} style={[styles.secondaryButton, (!today?.checkIn || today?.checkOut) && styles.disabled]}><Text style={styles.secondaryText}>Check out</Text></Pressable></View> }
function futureDate(days) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function Requests({ leaves, wfhRequests, grievances, loading, applyLeave, applyWfh, submitGrievance }) {
  const [leaveType, setLeaveType] = useState('casual');
  const [leaveDate, setLeaveDate] = useState(() => futureDate(7));
  const [leaveReason, setLeaveReason] = useState('');
  const [wfhDate, setWfhDate] = useState(() => futureDate(2));
  const [wfhLocation, setWfhLocation] = useState('Home');
  const [wfhReason, setWfhReason] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  return <><Text style={styles.sectionTitle}>Self-service requests</Text><View style={styles.card}><Text style={styles.formTitle}>Request leave</Text><TextInput value={leaveType} onChangeText={setLeaveType} placeholder="Leave type" style={styles.compactInput} /><TextInput value={leaveDate} onChangeText={setLeaveDate} placeholder="YYYY-MM-DD" style={styles.compactInput} /><TextInput value={leaveReason} onChangeText={setLeaveReason} placeholder="Reason" style={styles.compactInput} /><Pressable disabled={loading || !leaveDate || !leaveReason} onPress={() => applyLeave({ leaveType, date: leaveDate, reason: leaveReason })} style={[styles.primaryButton, (!leaveDate || !leaveReason) && styles.disabled]}><Text style={styles.primaryText}>Submit leave request</Text></Pressable></View><View style={styles.card}><Text style={styles.formTitle}>Request work from home</Text><TextInput value={wfhDate} onChangeText={setWfhDate} placeholder="YYYY-MM-DD" style={styles.compactInput} /><TextInput value={wfhLocation} onChangeText={setWfhLocation} placeholder="Work location" style={styles.compactInput} /><TextInput value={wfhReason} onChangeText={setWfhReason} placeholder="Reason" style={styles.compactInput} /><Pressable disabled={loading || !wfhDate || !wfhReason} onPress={() => applyWfh({ date: wfhDate, location: wfhLocation, reason: wfhReason })} style={[styles.primaryButton, (!wfhDate || !wfhReason) && styles.disabled]}><Text style={styles.primaryText}>Submit WFH request</Text></Pressable></View><View style={styles.card}><Text style={styles.formTitle}>Workplace support</Text><TextInput value={supportSubject} onChangeText={setSupportSubject} placeholder="Subject" style={styles.compactInput} /><TextInput value={supportDescription} onChangeText={setSupportDescription} placeholder="Describe your concern" multiline numberOfLines={4} style={[styles.compactInput, styles.multilineInput]} /><Pressable disabled={loading || !supportSubject || !supportDescription} onPress={() => submitGrievance({ subject: supportSubject, description: supportDescription })} style={[styles.secondaryButton, (!supportSubject || !supportDescription) && styles.disabled]}><Text style={styles.secondaryText}>Submit support request</Text></Pressable></View><Text style={styles.subheading}>Leave history</Text>{leaves.length ? leaves.map((leave) => <View key={leave._id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{leave.leaveType}</Text><Text style={styles.badge}>{leave.status}</Text></View><Text style={styles.muted}>{String(leave.startDate).slice(0, 10)} - {String(leave.endDate).slice(0, 10)}</Text><Text style={styles.body}>{leave.reason}</Text></View>) : <Empty label="No leave requests yet" />}<Text style={styles.subheading}>WFH history</Text>{wfhRequests.length ? wfhRequests.map((request) => <View key={request._id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{String(request.startDate || request.date).slice(0, 10)}</Text><Text style={styles.badge}>{request.status}</Text></View><Text style={styles.body}>{request.reason}</Text></View>) : <Empty label="No WFH requests yet" />}<Text style={styles.subheading}>Support history</Text>{grievances.length ? grievances.map((grievance) => <View key={grievance._id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{grievance.subject}</Text><Text style={styles.badge}>{grievance.status}</Text></View><Text style={styles.muted}>{grievance.ticketNumber}</Text><Text style={styles.body}>{grievance.description}</Text></View>) : <Empty label="No support requests yet" />}</>
}
function Team({ attendance, leaves, wfhRequests, grievances, loading, review }) { const openGrievances = grievances.filter((item) => !['resolved', 'closed'].includes(item.status)); return <><Text style={styles.sectionTitle}>My team</Text><View style={styles.grid}><Metric label="Team members" value={String(attendance.length)} /><Metric label="Pending leave" value={String(leaves.length)} /><Metric label="Pending WFH" value={String(wfhRequests.length)} /><Metric label="Open grievances" value={String(openGrievances.length)} /></View><Text style={styles.subheading}>Today&apos;s attendance</Text>{attendance.length ? attendance.map((item) => <View key={item.employee._id} style={styles.card}><View style={styles.row}><View><Text style={styles.cardTitle}>{item.employee.firstName} {item.employee.lastName}</Text><Text style={styles.muted}>{item.employee.employeeId}</Text></View><Text style={styles.badge}>{item.attendance?.status || 'not checked in'}</Text></View></View>) : <Empty label="No team members found" />}<Text style={styles.subheading}>Leave approvals</Text>{leaves.length ? leaves.map((leave) => <View key={leave._id} style={styles.card}><View style={styles.row}><View style={styles.flexOne}><Text style={styles.cardTitle}>{leave.employee.firstName} {leave.employee.lastName}</Text><Text style={styles.muted}>{leave.leaveType} - {leave.days} day(s)</Text></View><ApprovalButtons loading={loading} approve={() => review('leave', leave._id, 'approve')} reject={() => review('leave', leave._id, 'reject')} /></View></View>) : <Empty label="No leave approvals pending" />}<Text style={styles.subheading}>WFH approvals</Text>{wfhRequests.length ? wfhRequests.map((request) => <View key={request._id} style={styles.card}><View style={styles.row}><View style={styles.flexOne}><Text style={styles.cardTitle}>{request.employee?.firstName} {request.employee?.lastName}</Text><Text style={styles.muted}>{String(request.startDate || request.date).slice(0, 10)}</Text></View><ApprovalButtons loading={loading} approve={() => review('wfh', request._id, 'approve')} reject={() => review('wfh', request._id, 'reject')} /></View></View>) : <Empty label="No WFH approvals pending" />}<Text style={styles.subheading}>Grievances</Text>{openGrievances.length ? openGrievances.map((grievance) => <View key={grievance._id} style={styles.card}><View style={styles.row}><View style={styles.flexOne}><Text style={styles.cardTitle}>{grievance.subject}</Text><Text style={styles.muted}>{grievance.ticketNumber} - {grievance.employee ? `${grievance.employee.firstName} ${grievance.employee.lastName}` : 'Anonymous'}</Text></View><Pressable disabled={loading} onPress={() => review('grievance', grievance._id, 'resolve')} style={styles.approveButton}><Text style={styles.primaryText}>Resolve</Text></Pressable></View></View>) : <Empty label="No grievances require attention" />}</> }
function ApprovalButtons({ loading, approve, reject }) { return <View style={styles.approvalActions}><Pressable disabled={loading} onPress={approve} style={styles.approveButton}><Text style={styles.primaryText}>Approve</Text></Pressable><Pressable disabled={loading} onPress={reject} style={styles.rejectButton}><Text style={styles.rejectText}>Reject</Text></Pressable></View> }
function Work({ projects, tasks, employeeId }) { const projectNames = Object.fromEntries(projects.map((project) => [project._id, project.name])); const assignedTasks = tasks.filter((task) => !task.assignedTo || task.assignedTo === employeeId); return <><Text style={styles.sectionTitle}>My work</Text>{assignedTasks.length ? assignedTasks.map((task) => <View key={task._id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.badge}>{task.status}</Text></View><Text style={styles.muted}>{projectNames[task.projectId] || 'No project'} - {task.priority || 'medium'} priority</Text>{task.dueDate ? <Text style={styles.body}>Due {String(task.dueDate).slice(0, 10)}</Text> : null}</View>) : <Empty label="No tasks assigned yet" />}</> }
function Payslips({ payslips }) { return <><Text style={styles.sectionTitle}>Payslips</Text>{payslips.length ? payslips.map((item) => <View key={item._id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{item.period}</Text><Text style={styles.badge}>{item.status}</Text></View><Row label="Gross" value={`Rs.${item.gross}`} /><Row label="Deductions" value={`Rs.${item.deductions}`} /><Row label="Net pay" value={`Rs.${item.net}`} /></View>) : <Empty label="No payslips generated yet" />}</> }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View> }
function Row({ label, value }) { return <View style={styles.detailRow}><Text style={styles.muted}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View> }
function Empty({ label }) { return <View style={styles.empty}><Text style={styles.muted}>{label}</Text></View> }

const raisedSurface = {
  backgroundColor: theme.background,
  shadowColor: theme.shadow,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 0.85,
  shadowRadius: 7,
  elevation: 4,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  loginWrap: { flex: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  logo: { width: 48, height: 48, textAlign: 'center', paddingTop: Platform.OS === 'web' ? 10 : 7, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.primaryDark, color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: theme.text },
  eyebrow: { color: theme.primaryDeep, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  muted: { color: theme.muted, fontSize: 13 },
  body: { color: theme.text, marginTop: 10 },
  card: { ...raisedSurface, borderRadius: 12, padding: 18, marginBottom: 14 },
  label: { color: theme.text, fontWeight: '700', marginBottom: 7 },
  formTitle: { color: theme.text, fontSize: 17, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: theme.inset, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, padding: 13, marginBottom: 16, color: theme.text },
  compactInput: { backgroundColor: theme.inset, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, padding: 12, marginBottom: 10, color: theme.text },
  multilineInput: { minHeight: 96, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: theme.primaryDark, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: theme.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.7, shadowRadius: 5, elevation: 3 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { ...raisedSurface, borderColor: theme.primary, borderWidth: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: theme.primaryDeep, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  helper: { color: theme.muted, textAlign: 'center', marginTop: 14, fontSize: 12 },
  error: { color: theme.danger, marginBottom: 10 },
  header: { ...raisedSurface, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 2 },
  headerIdentity: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerButton: { ...raisedSurface, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 },
  roleText: { color: theme.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  refresh: { color: theme.primaryDeep, fontSize: 12, fontWeight: '800' },
  logout: { color: theme.danger, fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 104, maxWidth: 720, width: '100%', alignSelf: 'center' },
  notice: { borderRadius: 10, backgroundColor: theme.primarySoft, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F2C99F' },
  noticeText: { color: theme.primaryDeep },
  hero: { backgroundColor: theme.primaryDark, borderRadius: 12, padding: 20, marginBottom: 16, shadowColor: theme.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.8, shadowRadius: 7, elevation: 4 },
  heroLabel: { color: '#FBEAD8', fontWeight: '700' },
  heroValue: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', marginVertical: 6 },
  heroMeta: { color: '#FFF5EA' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { ...raisedSurface, minWidth: '46%', flex: 1, borderRadius: 12, padding: 15 },
  metricValue: { color: theme.text, fontSize: 17, fontWeight: '800', marginTop: 5 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  subheading: { color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  requestActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  smallButton: { backgroundColor: theme.primaryDark, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  outlineSmallButton: { borderColor: theme.primary, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  flexOne: { flex: 1, minWidth: 0 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.line },
  rowValue: { color: theme.text, fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.text, textTransform: 'capitalize' },
  badge: { backgroundColor: theme.primarySoft, color: theme.primaryDeep, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  approvalActions: { gap: 6 },
  approveButton: { backgroundColor: theme.success, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  rejectButton: { backgroundColor: '#FEF2F2', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  rejectText: { color: theme.danger, fontSize: 12, fontWeight: '800' },
  empty: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#BFB6A8', borderRadius: 8, padding: 30, alignItems: 'center', marginBottom: 8 },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.line, paddingBottom: Platform.OS === 'ios' ? 22 : 8, paddingTop: 8, shadowColor: theme.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.75, shadowRadius: 7, elevation: 8 },
  tabContent: { flexGrow: 1, paddingHorizontal: 8, gap: 4 },
  tab: { minWidth: 70, flexGrow: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  activeTab: { backgroundColor: theme.primarySoft },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  activeTabText: { color: theme.primaryDeep },
});
