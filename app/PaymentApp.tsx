"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Lock } from 'lucide-react';

// --- MOCK DEPENDENCIES FOR PREVIEW ---
// In your real app, uncomment your original imports and remove these mocks.
// import { QRCodeSVG } from 'qrcode.react';
// import { useAccount, usePublicClient } from 'wagmi';
// import { parseEther } from 'viem';
// import { sepolia } from 'wagmi/chains';

const QRCodeSVG = ({ value, size }) => (
    <img 
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} 
        alt="QR Code" 
        width={size} 
        height={size}
    />
);

const useAccount = () => ({ isConnected: true });
const usePublicClient = () => ({
    getBlockNumber: async () => BigInt(100),
    getBlock: async () => ({ transactions: [] })
});
const parseEther = (val) => val;
const sepolia = { id: 11155111 };
// -------------------------------------

const CONFIG = {
    // Ensure this address is lowercase for comparison logic
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    REQUIRED_AMOUNT: 0.001,
    AUDIO_SRC: "/alert.wav",
    PAYMENT_TIMEOUT: 50, // Seconds for payment flow
    SUCCESS_TIMEOUT: 10, // Seconds for liquid animation
    FINAL_MESSAGE_DURATION: 2000, // ms to show "Thank you"
    BLUR_THRESHOLD: 25   // Seconds remaining when blur triggers
};

export default function PaymentApp() {
    const [view, setView] = useState('landing');
    const [txHash, setTxHash] = useState('');
    
    // NEW: Track which phase of success we are in: 'timer' | 'message'
    const [successPhase, setSuccessPhase] = useState('timer');
    
    // Timer state for Payment Flow
    const [timeLeft, setTimeLeft] = useState(CONFIG.PAYMENT_TIMEOUT);
    
    // Timer state for Success Flow
    const [successTimeLeft, setSuccessTimeLeft] = useState(CONFIG.SUCCESS_TIMEOUT);

    // We track the block number when the user started the payment flow
    // FIXED: Changed 0n to BigInt(0) for environment compatibility
    const [startBlock, setStartBlock] = useState(BigInt(0));

    const audioRef = useRef(null);

    // Wagmi hook to read from blockchain
    const publicClient = usePublicClient();
    const { isConnected: isAppConnected } = useAccount(); 

    // Create the Standard Payment URI (EIP-681)
    const paymentURI = `ethereum:${CONFIG.MERCHANT_ADDRESS}@${sepolia.id}?value=${parseEther(CONFIG.REQUIRED_AMOUNT.toString()).toString()}`;

    // --- Utility Functions ---

    // Centralized cancel/reset function
    const handleReset = useCallback(() => {
        setView('landing');
        setTxHash('');
        setSuccessPhase('timer'); // Reset phase
        setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
        setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
    }, []);

    const playSuccessSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio playback failed:", error);
                });
            }
        }
    }, []);

    const handlePaymentSuccess = (hash) => {
        setTxHash(hash);
        setView('success');
        setSuccessPhase('timer'); // Ensure we start at timer
        playSuccessSound();
    };

    // --- Timer Logic (Payment Flow) ---
    useEffect(() => {
        let timerId;

        if (view === 'payment') {
            setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
            timerId = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        handleReset(); // Auto-cancel
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, handleReset]);

    // --- Timer Logic (Success Flow - Phase 1: Countdown) ---
    useEffect(() => {
        let timerId;

        if (view === 'success' && successPhase === 'timer') {
            setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
            timerId = setInterval(() => {
                setSuccessTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        // instead of resetting, we switch phase
                        setSuccessPhase('message'); 
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, successPhase]); 

    // --- Logic (Success Flow - Phase 2: Final Message) ---
    useEffect(() => {
        let timeoutId;

        if (view === 'success' && successPhase === 'message') {
            // Wait for 2 seconds (CONFIG.FINAL_MESSAGE_DURATION) then reset
            timeoutId = setTimeout(() => {
                handleReset();
            }, CONFIG.FINAL_MESSAGE_DURATION);
        }
        
        return () => clearTimeout(timeoutId);
    }, [view, successPhase, handleReset]);

    // --- The Watcher Logic ---
    useEffect(() => {
        let intervalId;

        const checkRecentBlocks = async () => {
            // FIXED: Changed 0n to BigInt(0)
            if (view !== 'payment' || !publicClient || startBlock === BigInt(0)) return;

            try {
                const currentBlock = await publicClient.getBlockNumber();

                if (currentBlock >= startBlock) {
                    const block = await publicClient.getBlock({ 
                        blockNumber: currentBlock, 
                        includeTransactions: true 
                    });

                    const foundTx = block.transactions.find((tx) => {
                        const isToMerchant = tx.to?.toLowerCase() === CONFIG.MERCHANT_ADDRESS;
                        const isCorrectAmount = tx.value >= parseEther(CONFIG.REQUIRED_AMOUNT.toString());
                        return isToMerchant && isCorrectAmount;
                    });

                    if (foundTx) {
                        handlePaymentSuccess(foundTx.hash);
                    }
                }
            } catch (error) {
                console.error("Error polling blockchain:", error);
            }
        };

        if (view === 'payment') {
            intervalId = setInterval(checkRecentBlocks, 3000);
        }

        return () => clearInterval(intervalId);
    }, [view, publicClient, startBlock]);


    // Initialize the Start Block when entering payment view
    useEffect(() => {
        if (view === 'payment' && publicClient) {
            publicClient.getBlockNumber().then(blockNum => {
                setStartBlock(blockNum);
            });
        }
    }, [view, publicClient]);


    // --- Helper for Ring Animation ---
    // Calculate properties for the "Time Expiring" ring
    const radius = 30; // Radius of the ring
    const circumference = 2 * Math.PI * radius;
    // Calculate progress (0 to 1) based on time left in the blur phase
    const progress = Math.max(0, timeLeft / CONFIG.BLUR_THRESHOLD); 
    const dashOffset = circumference * (1 - progress);


    // --- Component Rendering ---

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
                            
                            {/* REPLACED TEXT WITH RING ANIMATION */}
                            {timeLeft <= CONFIG.BLUR_THRESHOLD && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="relative w-24 h-24 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-full shadow-lg">
                                        {/* SVG Ring Container */}
                                        <svg className="w-full h-full transform -rotate-90">
                                            {/* Background Circle */}
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r={radius}
                                                stroke="#e2e8f0" // slate-200
                                                strokeWidth="6"
                                                fill="transparent"
                                            />
                                            {/* Progress Circle */}
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r={radius}
                                                stroke="#ef4444" // red-500
                                                strokeWidth="6"
                                                fill="transparent"
                                                strokeDasharray={circumference}
                                                strokeDashoffset={dashOffset}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000 ease-linear"
                                            />
                                        </svg>
                                        
                                        {/* Optional: Icon inside the ring */}
                                        <div className="absolute text-red-500 animate-pulse">
                                            <Lock size={24} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-slate-600 font-medium mb-2">
                            Send exactly: <span className="text-emerald-600 font-bold text-lg">{CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </p>
                        <p className="text-xs text-slate-400 mb-6">
                            On Sepolia Network
                        </p>

                        <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
                            <RefreshCw size={16} className="animate-spin" />
                            Waiting for transaction...
                        </div>

                        {/* DEBUG BUTTON FOR PREVIEW ONLY */}
                        <button 
                            onClick={() => handlePaymentSuccess("0x_mock_hash_123")}
                            className="mb-4 text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 hover:bg-slate-200"
                        >
                            (Debug: Simulate Success)
                        </button>

                        <button
                            onClick={handleReset}
                            className="block w-full text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            Cancel Transaction
                        </button>
                    </div>
                )}

                {/* VIEW: SUCCESS POPUP */}
                {view === 'success' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in">
                        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-emerald-500/30 max-w-md w-full text-center relative overflow-hidden transition-all duration-500 min-h-[400px] flex flex-col justify-center">
                            
                            {/* PHASE 1: CUP ANIMATION */}
                            {successPhase === 'timer' && (
                                <div className="animate-fade-in flex flex-col items-center">
                                    <h2 className="text-3xl font-bold text-white mb-2">Payment Verified!</h2>
                                    <p className="text-emerald-400 text-lg mb-8">Access Granted</p>

                                    {/* THE CUP ANIMATION */}
                                    <div className="relative w-24 h-32 border-4 border-white/20 border-t-0 rounded-b-2xl mb-8 overflow-hidden bg-slate-700/50 backdrop-blur-sm">
                                        {/* Liquid filling up */}
                                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-600 to-emerald-400 animate-fill-cup shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                                        
                                        {/* Cup Glare/Reflection */}
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
                            )}

                            {/* PHASE 2: THANK YOU MESSAGE */}
                            {successPhase === 'message' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in p-6 bg-slate-800 rounded-3xl z-20">
                                     <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-200 mb-4 animate-scale-in">
                                         Here you are!
                                    </h2>
                                    <p className="text-2xl text-emerald-400 font-medium">
                                        Thank you!
                                    </p>
                                </div>
                            )}

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
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fill-cup {
                    from { height: 0%; }
                    to { height: 100%; }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
                .animate-scale-in { animation: scale-in 0.5s ease-out; }
                .animate-fill-cup { animation: fill-cup 10s linear forwards; }
            `}</style>
        </div>
    );
}
