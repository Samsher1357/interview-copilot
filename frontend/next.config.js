/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle pdf-parse for server-side
      config.externals = [...(config.externals || []), 'canvas', 'canvas-prebuilt']
    }
    return config
  },
}

module.exports = nextConfig

