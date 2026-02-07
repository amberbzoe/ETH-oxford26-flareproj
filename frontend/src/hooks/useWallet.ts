import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export function useWallet() {
    const [address, setAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<string>("0.00");
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

    const connect = async () => {
        if (!window.ethereum) {
            alert("Please install MetaMask!");
            return;
        }

        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(browserProvider);

            const accounts = await browserProvider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                const newSigner = await browserProvider.getSigner();
                setSigner(newSigner);

                const balanceFn = await browserProvider.getBalance(accounts[0]);
                setBalance(ethers.formatEther(balanceFn));
            }
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    };

    useEffect(() => {
        // Check if wallet is already connected
        const checkConnection = async () => {
            if (window.ethereum) {
                const browserProvider = new ethers.BrowserProvider(window.ethereum);
                setProvider(browserProvider);

                try {
                    const accounts = await browserProvider.listAccounts();
                    if (accounts.length > 0) {
                        setAddress(accounts[0].address);
                        const newSigner = await browserProvider.getSigner();
                        setSigner(newSigner);

                        const balanceFn = await browserProvider.getBalance(accounts[0].address);
                        setBalance(ethers.formatEther(balanceFn));
                    }
                } catch (err) {
                    console.log("Not connected");
                }
            }
        };

        checkConnection();
    }, []);

    return { address, balance, signer, provider, connect };
}
