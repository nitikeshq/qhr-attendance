import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { API_ROOT } from "../api";
import { storage } from "./storage";

/**
 * Automatic attendance from geofence events.
 *
 * This is the product's core promise: an employee should not have to press
 * anything. The OS wakes the app when they arrive at or leave an approved site,
 * and the punch is reported to the server.
 *
 * Deliberate choices:
 *  - the task reads its token and config from storage, because a background
 *    wake-up has no React state to read from;
 *  - the server, not the device, decides whether an event becomes a punch, so
 *    boundary jitter cannot create duplicates;
 *  - a failed report is queued rather than dropped, because arrivals happen in
 *    basement car parks with no signal;
 *  - events outside working hours are ignored, so passing the office on a Sunday
 *    does not open a working day.
 */

export const GEOFENCE_TASK = "qhr-geofence-attendance";

function minutesFromClock(value, fallbackMinutes) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return fallbackMinutes;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Working hours with a deliberate margin, so somebody arriving a little early or
 * leaving a little late is still recorded rather than silently ignored.
 */
export function withinOperatingHours(operatingHours, now = new Date(), marginMinutes = 120) {
  if (!operatingHours) return true;
  const start = minutesFromClock(operatingHours.start, 9 * 60 + 30) - marginMinutes;
  const end = minutesFromClock(operatingHours.end, 18 * 60 + 30) + marginMinutes;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start && current <= end;
}

/** Reports one punch. Returns true when the server accepted responsibility for it. */
async function report(punch, token) {
  const response = await fetch(`${API_ROOT}/attendance/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(punch),
  });
  // 409 means the server considered and refused it (outside an area, nothing to
  // close). That is a decision, not a transport failure, so it is not retried.
  return response.ok || response.status === 409;
}

/** Sends anything that failed earlier, oldest first. */
export async function flushQueuedPunches(token) {
  if (!token) return;
  const queued = await storage.takeQueuedPunches();
  if (!queued.length) return;
  const failed = [];
  for (const punch of queued) {
    try {
      const accepted = await report(punch, token);
      if (!accepted) failed.push(punch);
    } catch (error) {
      failed.push(punch);
    }
  }
  await storage.restoreQueuedPunches(failed);
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return;

  const { eventType, region } = data;
  const event = eventType === Location.GeofencingEventType.Enter ? "enter" : "exit";

  const [session, config] = await Promise.all([storage.getSession(), storage.getGeofenceConfig()]);
  if (!session?.token) return;
  if (config?.autoCheckInEnabled === false) return;
  if (!withinOperatingHours(config?.operatingHours)) return;

  let coords = null;
  try {
    const position = await Location.getLastKnownPositionAsync({ maxAge: 60000 })
      || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    coords = position?.coords || null;
  } catch (locationError) {
    coords = null;
  }
  // Without a position the server cannot verify the area, and an unverifiable
  // punch is worse than none, so the event is dropped rather than guessed at.
  if (!coords) return;

  const punch = {
    event,
    regionId: region?.identifier || null,
    occurredAt: new Date().toISOString(),
    location: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
  };

  try {
    const accepted = await report(punch, session.token);
    if (!accepted) await storage.queuePunch(punch);
  } catch (networkError) {
    await storage.queuePunch(punch);
  }
});

/**
 * Arms geofencing for the signed-in employee.
 *
 * Returns a reason when it cannot start, so the UI can explain the situation
 * instead of pretending automatic attendance is running when it is not.
 */
export async function startGeofencing(token) {
  if (Platform.OS === "web") return { started: false, reason: "Automatic attendance needs the mobile app." };

  try {
    const response = await fetch(`${API_ROOT}/attendance/geofence-regions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { started: false, reason: "Could not load your work locations." };
    const config = (await response.json())?.data || {};
    await storage.saveGeofenceConfig(config);

    if (config.autoCheckInEnabled === false) {
      return { started: false, reason: "Your company has automatic check-in switched off." };
    }
    if (!config.regions?.length) {
      return { started: false, reason: "No work location has a geofence configured yet." };
    }

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") {
      return { started: false, reason: "Location permission is needed to record attendance." };
    }
    // Background permission is the part that makes this work with the app closed.
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== "granted") {
      return {
        started: false,
        reason: "Allow location \"all the time\" so attendance is recorded when the app is closed.",
      };
    }

    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
    }
    await Location.startGeofencingAsync(
      GEOFENCE_TASK,
      config.regions.map((area) => ({
        identifier: String(area.identifier),
        latitude: Number(area.latitude),
        longitude: Number(area.longitude),
        radius: Number(area.radius) || 150,
        notifyOnEnter: true,
        notifyOnExit: true,
      })),
    );

    await flushQueuedPunches(token);
    return { started: true, regions: config.regions.length };
  } catch (error) {
    return { started: false, reason: error?.message || "Automatic attendance could not start." };
  }
}

export async function stopGeofencing() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
    return true;
  } catch (error) {
    return false;
  }
}
