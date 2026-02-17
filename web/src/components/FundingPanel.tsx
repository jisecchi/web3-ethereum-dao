"use client";

import { useState } from "react";
import { parseEther } from "ethers";
import { useWeb3 } from "@/context/Web3Context";

export default function FundingPanel() {
  const { account, daoContract, userBalance, daoBalance, refreshBalances } =
    useWeb3();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const handleFund = async () => {
    if (!daoContract || !amount) return;
    setLoading(true);
    setTxStatus("Enviando transacción...");
    try {
      const tx = await daoContract.fundDAO({ value: parseEther(amount) });
      setTxStatus("Confirmando...");
      await tx.wait();
      setTxStatus("¡Fondos depositados exitosamente!");
      setAmount("");
      await refreshBalances();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      setTxStatus(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  if (!account) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        💰 Panel de Financiación
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-zinc-800 p-4">
          <p className="text-xs text-zinc-400">Tu balance en la DAO</p>
          <p className="text-xl font-bold text-blue-400">{userBalance} ETH</p>
        </div>
        <div className="rounded-lg bg-zinc-800 p-4">
          <p className="text-xs text-zinc-400">Balance total de la DAO</p>
          <p className="text-xl font-bold text-green-400">{daoBalance} ETH</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Cantidad en ETH"
          className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          disabled={loading}
        />
        <button
          onClick={handleFund}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Depositar"}
        </button>
      </div>

      {txStatus && (
        <p
          className={`mt-3 text-sm ${
            txStatus.startsWith("Error")
              ? "text-red-400"
              : txStatus.startsWith("¡")
              ? "text-green-400"
              : "text-yellow-400"
          }`}
        >
          {txStatus}
        </p>
      )}
    </div>
  );
}
