"use client";

import { useState } from 'react';
import { CreditCard, Zap, RefreshCw, Activity, Lock } from 'lucide-react';
import { WagmiConfig } from 'wagmi';

// Import WalletConnect setup and core client
import { config, projectId, metadata } from './wagmi'; 
import { useWeb3Modal } from '@web3modal/wagmi/react';

// You will need to define this component in a separate file (e.g., './PaymentApp')
import PaymentApp from './PaymentApp'; 


export default function Page() {
    return (
        <WagmiConfig config={config}>
            <PaymentApp />
        </WagmiConfig>
    );
}
