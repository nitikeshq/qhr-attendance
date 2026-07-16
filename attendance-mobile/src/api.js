import { Platform } from 'react-native';

const localHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const configured = process.env.EXPO_PUBLIC_API_URL || `http://${localHost}:5001`;
export const API_ROOT = /\/api\/v\d+\/?$/i.test(configured) ? configured.replace(/\/$/, '') : `${configured.replace(/\/$/, '')}/api/v1`;

export async function api(path, options = {}, token) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload.data;
}
