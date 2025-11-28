/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Dependency Fix (for pino/thread-stream): 
  // Using the Next.js 14/15 key for externalizing Server Components packages.
  serverComponentsExternalPackages: ["pino", "pino-pretty", "thread-stream"],

  // 2. Ignore TS errors during build (still useful, even if the file is JS)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 3. Webpack externals for Node modules (needed for your libraries):
  webpack: (config, { isServer }) => {
    if (isServer) {
      // These modules must be externalized for the server build to prevent errors with pino/logging
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    return config;
  },
};

module.exports = nextConfig;
