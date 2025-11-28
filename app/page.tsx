// page.tsx

// 1. We keep 'use client' because the file uses client-side hooks/components (like WagmiProvider).
"use client";

import { useState } from 'react';
import { CreditCard, Zap, RefreshCw, Activity, Lock } from 'lucide-react';
// 2. FIX 1: Rename the import from WagmiConfig to WagmiProvider (Wagmi V2 breaking change).
import { WagmiProvider } from 'wagmi'; 
import dynamic from 'next/dynamic'; // Import dynamic for SSR fix

// Import WalletConnect setup and core client
import { config, projectId, metadata } from './wagmi'; 
import { useWeb3Modal } from '@web3modal/wagmi/react';

// 3. FIX 2: Dynamically import PaymentApp and disable Server-Side Rendering (SSR).
// This prevents the 'indexedDB is not defined' error during the build phase.
const PaymentAppDynamic = dynamic(() => import('./PaymentApp'), {
    ssr: false,
    loading: () => (
        <div className="flex justify-center items-center h-48">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="ml-3">Loading Wallet Interface...</p>
        </div>
    ),
});

export default function Page() {
    return (
        // 4. FIX 1: Use WagmiProvider (Wagmi V2 name) instead of WagmiConfig.
        <WagmiProvider config={config}>
            {/* 5. Render the dynamically imported component */}
            <PaymentAppDynamic />
        </WagmiProvider>
    );
}