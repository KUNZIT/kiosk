/** @type {import('next').NextConfig} */
const nextConfig = {
  
  transpilePackages: [
    '@wagmi/connectors',
    '@web3modal/wagmi',
    '@web3modal/core',
    'wagmi',
    'pino', 
    'thread-stream',
  ],
  
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  
  webpack: (config, { isServer, webpack }) => {
    
    config.externals = [
      ...(config.externals || []),
      'porto', 
      'porto/internal', 
      '@base-org/account',
      '@gemini-wallet/core',
      '@metamask/sdk',
      '@safe-global/safe-apps-sdk', 
      '@safe-global/safe-apps-provider',
      

      'ws',
      'bufferutil', 
      'utf-8-validate', 
    ];
    
    
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }

    
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(porto\/internal)$/,
      })
    );
    
    return config;
  },
};

module.exports = nextConfig;
