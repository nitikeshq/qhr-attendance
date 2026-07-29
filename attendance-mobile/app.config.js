const appJson = require('./app.json');

// EXPO_BASE_URL lets the web export be served from a sub-path (e.g. /app) behind a
// reverse proxy. Unset locally, so `expo start --web` keeps serving from the root.
const baseUrl = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');

module.exports = () => ({
  ...appJson.expo,
  ...(baseUrl
    ? { experiments: { ...(appJson.expo.experiments || {}), baseUrl } }
    : {}),
});
