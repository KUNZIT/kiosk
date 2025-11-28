import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi';
// ADDED: Import viem's http function for robust transport setup
import { http } from 'viem';

import { sepolia } from 'wagmi/chains';
import { reconnect } from '@wagmi/core';
import { QueryClient } from '@tanstack/react-query';

// 1. Get WalletConnect Project ID from Environment Variable
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || ''; 

// Error check: If running in the browser and the ID is missing, throw an error
if (typeof window !== 'undefined' && !projectId) {
  throw new Error('WalletConnect Project ID is missing. Set NEXT_PUBLIC_WALLETCONNECT_ID environment variable.');
}


// 2. Define our chain
const chains = [sepolia] as const;

// 3. Metadata for Web3Modal
export const metadata = {
  name: 'Future Pay Sepolia',
  description: 'WalletConnect integration for Future Pay',
  url: 'https://my-kiosk-url.com', 
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 4. Wagmi Config (Uses your NEXT_PUBLIC_RPC_URL)
// We use the viem `http` function to create the transport provider correctly.
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true, // Use SSR when using Next.js
  
  // FIX: Explicitly define the transport using viem's http() function
  transports: {
    [sepolia.id]: http(
      // Prioritize the environment variable RPC URL, falling back to the chain's default
      process.env.NEXT_PUBLIC_RPC_URL || sepolia.rpcUrls.default.http[0]
    ),
  },
});

// 5. Create Web3Modal instance (This registers the QR code/Modal logic)
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  themeVariables: {
    '--w3m-accent': '#10b981', // Emerald green color
  },
  enableAnalytics: false, // Optional
});

// 6. Reconnect wallets on load (optional but good practice)
reconnect(wagmiConfig);

// EXPORTS: Required by app/page.tsx
export { wagmiConfig as config };
export const queryClient = new QueryClient();