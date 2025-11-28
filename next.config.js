/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Correct key for Next.js 14.x.
  serverComponentsExternalPackages: [
    "pino", 
    "pino-pretty", 
    "thread-stream",
    "porto",
  ],
  
  // 2. Ignore TS errors during build.
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 3. Webpack externals and Aggressive Fix
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      // Fixes for pino/lokijs
      config.externals.push("pino-pretty", "lokijs", "encoding");

      // AGGRESSIVE FIX for 'porto/internal' and similar deep Web3 bundling issues:
      // This tells Webpack to ignore the internal package structure of these modules 
      // which often break the build process.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(porto\/internal)$/,
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;