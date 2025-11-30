"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Lock, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { parseEther, createPublicClient, http } from 'viem';
import { mainnet, base, linea, sepolia } from 'viem/chains';

// --- CONFIGURATION ---
const CONFIG = {
    // Merchant Address (Lowercase for safety)
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    
    // The amount in "Native" currency (ETH on all these networks)
    REQUIRED_AMOUNT: 0.001,
    
    AUDIO_SRC: "/alert.wav",
    PAYMENT_TIMEOUT: 50, 
    SUCCESS_TIMEOUT: 10, 
    BLUR_THRESHOLD: 25,

    // The Octopus List: Networks we listen to simultaneously
    SUPPORTED_NETWORKS: [mainnet, base, linea, sepolia]
};

export default function PaymentApp() {
    const [view, setView] = useState('landing');
    const [txHash, setTxHash] = useState('');
    const [detectedNetwork, setDetectedNetwork] = useState(''); // To show which network caught the tx

    // Timers
    const [timeLeft, setTimeLeft] = useState(CONFIG.PAYMENT_TIMEOUT);
    const [successTimeLeft, setSuccessTimeLeft] = useState(CONFIG.SUCCESS_TIMEOUT);

    // We need to track the starting block number for EACH chain separately
    // Structure: { 1: 18000000n, 8453: 5000000n, ... }
    const [chainStartBlocks, setChainStartBlocks] = useState<Record<number, bigint>>({});

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- QR Code URI (Unified) ---
    // Note: We REMOVED the chain ID (@11155111) to make it universal.
    // Wallet will default to current network, or user can switch.
    const paymentURI = `ethereum:${CONFIG.MERCHANT_ADDRESS}?value=${parseEther(CONFIG.REQUIRED_AMOUNT.toString()).toString()}`;

    // --- Utility Functions ---

    const handleReset = useCallback(() => {
        setView('landing');
        setTxHash('');
        setDetectedNetwork('');
        setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
        setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
        setChainStartBlocks({});
    }, []);

    const playSuccessSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => console.error("Audio error:", error));
            }
        }
    }, []);

    const handlePaymentSuccess = (hash: string, networkName: string) => {
        setTxHash(hash);
        setDetectedNetwork(networkName);
        setView('success');
        playSuccessSound();
    };

    // --- Timer Logic (Payment) ---
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (view === 'payment') {
            setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
            timerId = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        handleReset();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, handleReset]);

    // --- Timer Logic (Success) ---
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (view === 'success') {
            setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
            timerId = setInterval(() => {
                setSuccessTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        handleReset();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, handleReset]);


    // --- THE OCTOPUS: Parallel Chain Initialization ---
    // When user clicks "Pay", we take a snapshot of the current block height on ALL chains.
    useEffect(() => {
        const initializeChains = async () => {
            if (view === 'payment') {
                const newStartBlocks: Record<number, bigint> = {};

                // Create a client for each chain and fetch block number in parallel
                await Promise.all(CONFIG.SUPPORTED_NETWORKS.map(async (chain) => {
                    try {
                        const client = createPublicClient({ chain, transport: http() });
                        const blockNumber = await client.getBlockNumber();
                        newStartBlocks[chain.id] = blockNumber;
                        // console.log(`Initialized ${chain.name} at block ${blockNumber}`);
                    } catch (err) {
                        console.error(`Failed to init ${chain.name}:`, err);
                    }
                }));

                setChainStartBlocks(newStartBlocks);
            }
        };

        initializeChains();
    }, [view]);


    // --- THE OCTOPUS: Parallel Polling ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkAllChains = async () => {
            if (view !== 'payment') return;

            // We loop through our supported networks
            CONFIG.SUPPORTED_NETWORKS.forEach(async (chain) => {
                const startBlock = chainStartBlocks[chain.id];
                
                // If we haven't initialized this chain yet, skip
                if (!startBlock) return;

                try {
                    // Create a lightweight client for this specific check
                    const client = createPublicClient({ chain, transport: http() });
                    const currentBlock = await client.getBlockNumber();

                    // Only check if new blocks have appeared
                    if (currentBlock >= startBlock) {
                        const block = await client.getBlock({ 
                            blockNumber: currentBlock, 
                            includeTransactions: true 
                        });

                        const foundTx = block.transactions.find((tx: any) => {
                            const isToMerchant = tx.to?.toLowerCase() === CONFIG.MERCHANT_ADDRESS;
                            const isCorrectAmount = tx.value >= parseEther(CONFIG.REQUIRED_AMOUNT.toString());
                            return isToMerchant && isCorrectAmount;
                        });

                        if (foundTx) {
                            handlePaymentSuccess(foundTx.hash, chain.name);
                        }
                    }
                } catch (error) {
                    // Fail silently for one chain so others keep working
                    // console.warn(`Polling error on ${chain.name}`);
                }
            });
        };

        if (view === 'payment') {
            // Poll every 3 seconds
            intervalId = setInterval(checkAllChains, 3000);
        }

        return () => clearInterval(intervalId);
    }, [view, chainStartBlocks]);


    // --- UI Rendering ---

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            
            <audio ref={audioRef} src={CONFIG.AUDIO_SRC} preload="auto" />

            {/* MAIN CONTENT AREA */}
            <main className="flex flex-col items-center justify-center min-h-screen p-6">

                {/* VIEW: LANDING */}
                {view === 'landing' && (
                    <div className="text-center space-y-8 animate-fade-in">
                        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                            FUTURE PAY
                        </h1>

                        <button
                            onClick={() => setView('payment')}
                            className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <span>Pay {CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </button>
                    </div>
                )}

                {/* VIEW: PAYMENT */}
                {view === 'payment' && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
                        <div className="mb-6 flex justify-between items-center text-slate-500">
                            <span className="text-xs font-bold tracking-widest uppercase">Scan to Pay</span>
                            <span className={`text-xs font-mono px-2 py-1 rounded font-bold transition-colors ${timeLeft <= 10 ? 'bg-red-100 text-red-600' : 'bg-slate-100'}`}>
                                Time left: {timeLeft}s
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center mb-6 relative">
                            {/* The Magic QR Code */}
                            <div className={`bg-white p-2 border-2 border-emerald-500 rounded-xl shadow-lg transition-all duration-700 ease-in-out ${timeLeft <= CONFIG.BLUR_THRESHOLD ? 'blur-md opacity-20 pointer-events-none select-none' : ''}`}>
                                <QRCodeSVG 
                                    value={paymentURI}
                                    size={200}
                                    level={"H"}
                                    includeMargin={true}
                                />
                            </div>
                            
                            {timeLeft <= CONFIG.BLUR_THRESHOLD && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-slate-900 font-bold bg-white/80 px-3 py-1 rounded-full text-sm shadow-sm animate-pulse">
                                        Time Expiring...
                                    </span>
                                </div>
                            )}
                        </div>

                        <p className="text-slate-600 font-medium mb-1">
                            Send exactly: <span className="text-emerald-600 font-bold text-lg">{CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </p>
                        
                        {/* NEW: Supported Networks Paragraph */}
                        <div className="flex items-start justify-center gap-2 text-slate-400 mb-6 max-w-[250px] mx-auto">
                            <ShieldCheck size={16} className="mt-1 shrink-0 text-emerald-500" />
                            <p className="text-xs leading-relaxed text-left">
                                App supports <strong>Ethereum Mainnet</strong>, <strong>Base</strong>, <strong>Linea</strong>, and <strong>Sepolia Testnet</strong>.
                            </p>
                        </div>

                        <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
                            <RefreshCw size={16} className="animate-spin" />
                            Scanning all networks...
                        </div>

                        <button
                            onClick={handleReset}
                            className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            Cancel Transaction
                        </button>
                    </div>
                )}

                {/* VIEW: SUCCESS POPUP */}
                {view === 'success' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in">
                        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-emerald-500/30 max-w-md w-full text-center relative overflow-hidden">
                            
                            <div className="relative z-10 flex flex-col items-center">
                                <h2 className="text-3xl font-bold text-white mb-2">Payment Verified!</h2>
                                <p className="text-emerald-400 text-lg mb-2">Access Granted</p>
                                
                                {/* Network Badge */}
                                <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-8 border border-emerald-500/30">
                                    Received on {detectedNetwork}
                                </div>

                                {/* THE CUP ANIMATION */}
                                <div className="relative w-24 h-32 border-4 border-white/20 border-t-0 rounded-b-2xl mb-8 overflow-hidden bg-slate-700/50 backdrop-blur-sm">
                                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-600 to-emerald-400 animate-fill-cup shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                                    <div className="absolute top-0 right-2 w-2 h-full bg-white/10 rounded-full blur-[1px]"></div>
                                </div>

                                <div className="w-full text-center">
                                    <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-1">
                                        Closing in
                                    </p>
                                    <p className="text-2xl font-bold text-white">
                                        {successTimeLeft}s
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fill-cup {
                    from { height: 0%; }
                    to { height: 100%; }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
                .animate-fill-cup { animation: fill-cup 10s linear forwards; }
            `}</style>
        </div>
    );
}
