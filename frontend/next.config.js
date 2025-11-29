/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for deployment
  output: 'standalone',
  // Disable static page generation errors from failing build
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle pdf-parse for server-side
      config.externals = [...(config.externals || []), 'canvas', 'canvas-prebuilt']
    }
    return config
  },
}

module.exports = nextConfig

