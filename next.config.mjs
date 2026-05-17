/** @type {import('next').NextConfig} */
const nextConfig = {
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  images: {
    unoptimized: true,
  },
  // Strip debug console.* from production builds; keep error/warn.
  // Dev builds keep everything for debugging.
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
}

export default nextConfig
