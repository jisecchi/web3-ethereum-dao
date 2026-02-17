"use client";

import { useState } from "react";
import { parseEther } from "ethers";
import { useWeb3 } from "@/context/Web3Context";

export default function CreateProposal() {
  const { account, daoContract, userBalance, daoBalance, refreshBalances } =
    useWeb3();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("3");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  if (!account) return null;

  const daoBalNum = parseFloat(daoBalance);
  const userBalNum = parseFloat(userBalance);
  const canCreate = daoBalNum > 0 && userBalNum >= daoBalNum * 0.1;

  const handleCreate = async () => {
    if (!daoContract || !recipient || !amount || !deadlineDays) return;
    setLoading(true);
    setTxStatus("Creando propuesta...");
    try {
      const deadline = Math.floor(
        Date.now() / 1000 + parseInt(deadlineDays) * 86400
      );
      const tx = await daoContract.createProposal(
        recipient,
        parseEther(amount),
        deadline
      );
      setTxStatus("Confirmando...");
      await tx.wait();
      setTxStatus("¡Propuesta creada exitosamente!");
      setRecipient("");
      setAmount("");
      setDeadlineDays("3");
      await refreshBalances();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      setTxStatus(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        📝 Crear Propuesta
      </h2>

      {!canCreate && (
        <div className="mb-4 rounded-lg bg-yellow-600/20 p-3 text-sm text-yellow-400">
          Necesitas al menos el 10% del balance total de la DAO (
          {(daoBalNum * 0.1).toFixed(4)} ETH) para crear propuestas. Tu balance
          actual: {userBalance} ETH.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Dirección del beneficiario
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            disabled={loading || !canCreate}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Cantidad (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            disabled={loading || !canCreate}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Plazo de votación (días)
          </label>
          <input
            type="number"
            min="1"
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            disabled={loading || !canCreate}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !canCreate || !recipient || !amount}
          className="w-full rounded-lg bg-purple-600 py-2 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear Propuesta"}
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
