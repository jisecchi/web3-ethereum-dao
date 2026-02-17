"use client";

import { useWeb3 } from "@/context/Web3Context";

export default function ConnectWallet() {
  const { account, isConnecting, connectWallet, disconnectWallet, chainId } =
    useWeb3();

  if (account) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-zinc-300">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
          {chainId && (
            <span className="text-xs text-zinc-500">
              (Chain {chainId})
            </span>
          )}
        </div>
        <button
          onClick={disconnectWallet}
          className="rounded-lg bg-red-600/20 px-3 py-2 text-sm text-red-400 transition hover:bg-red-600/30"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
    >
      {isConnecting ? "Conectando..." : "Conectar Wallet"}
    </button>
  );
}
