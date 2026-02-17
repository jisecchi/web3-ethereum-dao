"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { DAO_ABI } from "@/contracts/abis";
import { config } from "@/contracts/config";

interface Web3ContextType {
  account: string | null;
  provider: BrowserProvider | null;
  daoContract: Contract | null;
  userBalance: string;
  daoBalance: string;
  chainId: number | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  provider: null,
  daoContract: null,
  userBalance: "0",
  daoBalance: "0",
  chainId: null,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  refreshBalances: async () => {},
});

export function useWeb3() {
  return useContext(Web3Context);
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [daoContract, setDaoContract] = useState<Contract | null>(null);
  const [userBalance, setUserBalance] = useState("0");
  const [daoBalance, setDaoBalance] = useState("0");
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const refreshBalances = useCallback(async () => {
    if (!daoContract || !account) return;
    try {
      const [uBal, dBal] = await Promise.all([
        daoContract.getUserBalance(account),
        daoContract.totalDAOBalance(),
      ]);
      setUserBalance(formatEther(uBal));
      setDaoBalance(formatEther(dBal));
    } catch (err) {
      console.error("Error refreshing balances:", err);
    }
  }, [daoContract, account]);

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Por favor instala MetaMask");
      return;
    }
    setIsConnecting(true);
    try {
      if (!config.daoAddress) {
        alert("Dirección del contrato DAO no configurada. Verifica .env.local");
        return;
      }
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const signer = await browserProvider.getSigner();

      const dao = new Contract(config.daoAddress, DAO_ABI, signer);

      setProvider(browserProvider);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setDaoContract(dao);
    } catch (err) {
      console.error("Error connecting wallet:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setDaoContract(null);
    setUserBalance("0");
    setDaoBalance("0");
    setChainId(null);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnectWallet]);

  // Refresh balances when account or contract changes
  useEffect(() => {
    if (account && daoContract) {
      refreshBalances();
    }
  }, [account, daoContract, refreshBalances]);

  return (
    <Web3Context.Provider
      value={{
        account,
        provider,
        daoContract,
        userBalance,
        daoBalance,
        chainId,
        isConnecting,
        connectWallet,
        disconnectWallet,
        refreshBalances,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}
