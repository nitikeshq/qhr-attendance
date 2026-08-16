import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistent state the app needs outside React.
 *
 * The session used to live only in component state, so a reload signed the user
 * out. That was survivable for a manual app, but automatic attendance cannot work
 * that way: a geofence task wakes up with no React tree at all, so it has to read
 * the token and settings from storage.
 */

const KEYS = {
  session: "qhr.session",
  geofence: "qhr.geofence",
  pending: "qhr.pendingPunches",
};

async function readJson(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export const storage = {
  async saveSession(session) {
    return writeJson(KEYS.session, session);
  },
  async getSession() {
    return readJson(KEYS.session, null);
  },
  async clearSession() {
    await AsyncStorage.multiRemove([KEYS.session, KEYS.geofence, KEYS.pending]).catch(() => {});
  },

  /** Regions and operating hours, cached so a background wake-up needs no network. */
  async saveGeofenceConfig(config) {
    return writeJson(KEYS.geofence, config);
  },
  async getGeofenceConfig() {
    return readJson(KEYS.geofence, { regions: [], operatingHours: null, autoCheckInEnabled: false });
  },

  /**
   * Punches that could not reach the server. A geofence event happens whether or
   * not there is signal, so an arrival in a basement car park must not be lost.
   */
  async queuePunch(punch) {
    const queue = await readJson(KEYS.pending, []);
    queue.push(punch);
    // Bounded, so a long offline spell cannot grow without limit.
    return writeJson(KEYS.pending, queue.slice(-50));
  },
  async takeQueuedPunches() {
    const queue = await readJson(KEYS.pending, []);
    if (queue.length) await writeJson(KEYS.pending, []);
    return queue;
  },
  async restoreQueuedPunches(punches) {
    if (!punches.length) return true;
    const queue = await readJson(KEYS.pending, []);
    return writeJson(KEYS.pending, [...punches, ...queue].slice(-50));
  },
};
