/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. We keep transpilePackages to stabilize Web3 code bundling
  transpilePackages: [
    '@wagmi/connectors',
    '@web3modal/wagmi',
    '@web3modal/core',
    'wagmi',
    'pino', 
    'thread-stream',
  ],
  
  // 2. Ignore TS errors during build.
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 3. Webpack externals and Aggressive Fixes (CRITICAL)
  webpack: (config, { isServer, webpack }) => {
    // EXPANDED LIST: This list forces Webpack to treat ALL missing, 
    // optional wallet connector dependencies as external, which stops the "Module not found" error.
    config.externals = [
      ...(config.externals || []),
      'porto', // Persistent Porto module
      'porto/internal', // Explicitly add the internal path to externals just in case
      '@base-org/account',
      '@gemini-wallet/core',
      '@metamask/sdk',
      // NEW MISSING DEPENDENCIES ADDED:
      '@safe-global/safe-apps-sdk', 
      '@safe-global/safe-apps-provider', 
    ];
    
    if (isServer) {
      // Fixes for pino/lokijs/etc. in the server environment
      config.externals.push("pino-pretty", "lokijs", "encoding");

      // AGGRESSIVE FIX: Ignore plugin for the 'porto/internal' import path
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