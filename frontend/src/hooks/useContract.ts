import { useMemo } from "react";
import { ethers } from "ethers";
import { VAULT_ADDRESS, VAULT_ABI } from "../config/contract";

export function useContract(signer: ethers.JsonRpcSigner | null) {
    const contract = useMemo(() => {
        if (!signer) {
            return null;
        }
        return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
    }, [signer]);

    return contract;
}
