/** @type {import('next').NextConfig} */
// BASE_PATH lets the landing site be served under a sub-path (e.g. /qhr) behind a
// shared reverse proxy. Left unset for local development so http://localhost:3002 works.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
}

module.exports = nextConfig
