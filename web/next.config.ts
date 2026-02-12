import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep Turbopack root deterministic even when multiple lockfiles exist nearby.
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
