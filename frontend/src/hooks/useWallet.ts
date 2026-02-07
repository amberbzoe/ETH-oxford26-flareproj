import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { COSTON2_CHAIN_ID, COSTON2_NETWORK } from '../config/contract';

export function useWallet() {
    const [address, setAddress] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [isCoston2, setIsCoston2] = useState<boolean>(false);

    const switchToCoston2 = async () => {
        if (!window.ethereum) return;
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: COSTON2_NETWORK.chainId }],
            });
        } catch (e: any) {
            // Chain not added — add it
            if (e.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [COSTON2_NETWORK],
                });
            }
        }
    };

    const connect = async () => {
        if (!window.ethereum) {
            alert("Please install MetaMask!");
            return;
        }

        try {
            await switchToCoston2();

            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(browserProvider);

            const accounts = await browserProvider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                const newSigner = await browserProvider.getSigner();
                setSigner(newSigner);
            }

            const network = await browserProvider.getNetwork();
            setIsCoston2(Number(network.chainId) === COSTON2_CHAIN_ID);
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    };

    useEffect(() => {
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
                    }
                    const network = await browserProvider.getNetwork();
                    setIsCoston2(Number(network.chainId) === COSTON2_CHAIN_ID);
                } catch (err) {
                    console.log("Not connected");
                }

                // Listen for chain/account changes
                window.ethereum.on?.("chainChanged", () => window.location.reload());
                window.ethereum.on?.("accountsChanged", () => window.location.reload());
            }
        };

        checkConnection();
    }, []);

    return { address, signer, provider, connect, isCoston2 };
}
