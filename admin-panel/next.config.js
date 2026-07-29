/** @type {import('next').NextConfig} */
// BASE_PATH lets the admin panel be served under a sub-path (e.g. /admin) behind a
// reverse proxy. Left unset for local development so http://localhost:3003 keeps working.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
}

module.exports = nextConfig
