"use client";

import { useState, useEffect, useCallback } from "react";
import { formatEther, Contract, Interface } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import { config } from "@/contracts/config";
import { FORWARDER_ABI, DAO_ABI } from "@/contracts/abis";
import { Proposal, VoteType, ProposalStatus } from "@/types/dao";
import VoteButtons from "./VoteButtons";

interface ProposalCardProps {
  proposal: Proposal;
  onRefresh: () => void;
}

function getProposalStatus(proposal: Proposal): ProposalStatus {
  if (proposal.executed) return "executed";
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < proposal.deadline) return "active";
  if (proposal.votesFor > proposal.votesAgainst) return "approved";
  return "rejected";
}

function statusLabel(status: ProposalStatus) {
  const map: Record<ProposalStatus, { text: string; color: string }> = {
    active: { text: "Activa", color: "bg-blue-600/20 text-blue-400" },
    approved: { text: "Aprobada", color: "bg-green-600/20 text-green-400" },
    rejected: { text: "Rechazada", color: "bg-red-600/20 text-red-400" },
    executed: { text: "Ejecutada", color: "bg-purple-600/20 text-purple-400" },
    pending: { text: "Pendiente", color: "bg-yellow-600/20 text-yellow-400" },
  };
  return map[status];
}

export default function ProposalCard({ proposal, onRefresh }: ProposalCardProps) {
  const { account, provider } = useWeb3();
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<VoteType | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);

  const status = getProposalStatus(proposal);
  const sLabel = statusLabel(status);
  const deadline = new Date(Number(proposal.deadline) * 1000);
  const isActive = status === "active";

  const checkUserVote = useCallback(async () => {
    if (!account || !provider) return;
    try {
      const dao = new Contract(config.daoAddress, DAO_ABI, provider);
      const voted = await dao.hasUserVoted(proposal.id, account);
      setHasVoted(voted);
      if (voted) {
        const vote = await dao.getUserVote(proposal.id, account);
        setUserVote(Number(vote) as VoteType);
      }
    } catch {
      // ignore
    }
  }, [account, provider, proposal.id]);

  useEffect(() => {
    checkUserVote();
  }, [checkUserVote]);

  const handleVote = async (voteType: VoteType) => {
    if (!account || !provider) return;
    setVoteLoading(true);
    setVoteStatus("Firmando voto...");

    try {
      // Build the vote calldata
      const daoInterface = new Interface(DAO_ABI);
      const data = daoInterface.encodeFunctionData("vote", [
        proposal.id,
        voteType,
      ]);

      // Get nonce from forwarder
      const forwarder = new Contract(
        config.forwarderAddress,
        FORWARDER_ABI,
        provider
      );
      const nonce = await forwarder.getNonce(account);

      // Build ForwardRequest
      const request = {
        from: account,
        to: config.daoAddress,
        value: 0,
        gas: 1_000_000,
        nonce: Number(nonce),
        data: data,
      };

      // EIP-712 signature
      const signer = await provider.getSigner();
      const domain = {
        name: "MinimalForwarder",
        version: "1",
        chainId: config.chainId,
        verifyingContract: config.forwarderAddress,
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      };

      const signature = await signer.signTypedData(domain, types, request);

      setVoteStatus("Enviando al relayer...");

      // Send to relay API
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, signature }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Error en el relayer");
      }

      setVoteStatus("¡Voto registrado exitosamente! (Gasless)");
      setHasVoted(true);
      setUserVote(voteType);
      onRefresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      setVoteStatus(`Error: ${errorMsg}`);
    } finally {
      setVoteLoading(false);
      setTimeout(() => setVoteStatus(null), 5000);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Propuesta #{Number(proposal.id)}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${sLabel.color}`}
        >
          {sLabel.text}
        </span>
      </div>

      {/* Details */}
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-400">Beneficiario:</span>
          <span className="font-mono text-zinc-300">
            {proposal.recipient.slice(0, 6)}...{proposal.recipient.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Monto:</span>
          <span className="font-semibold text-white">
            {formatEther(proposal.amount)} ETH
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Fecha límite:</span>
          <span className="text-zinc-300">{deadline.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Creador:</span>
          <span className="font-mono text-zinc-300">
            {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
          </span>
        </div>
      </div>

      {/* Votes */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-green-900/20 p-2 text-center">
          <p className="text-lg font-bold text-green-400">
            {Number(proposal.votesFor)}
          </p>
          <p className="text-xs text-zinc-400">A Favor</p>
        </div>
        <div className="rounded-lg bg-red-900/20 p-2 text-center">
          <p className="text-lg font-bold text-red-400">
            {Number(proposal.votesAgainst)}
          </p>
          <p className="text-xs text-zinc-400">En Contra</p>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2 text-center">
          <p className="text-lg font-bold text-zinc-400">
            {Number(proposal.votesAbstain)}
          </p>
          <p className="text-xs text-zinc-400">Abstención</p>
        </div>
      </div>

      {/* Vote Buttons (active proposals only) */}
      {isActive && account && (
        <div>
          <p className="mb-2 text-xs text-zinc-500">
            {hasVoted
              ? "Ya votaste. Puedes cambiar tu voto:"
              : "Vota sin gas (meta-transacción):"}
          </p>
          <VoteButtons
            currentVote={userVote}
            hasVoted={hasVoted}
            onVote={handleVote}
            disabled={!isActive}
            loading={voteLoading}
          />
        </div>
      )}

      {/* Vote Status */}
      {voteStatus && (
        <p
          className={`mt-3 text-xs ${
            voteStatus.startsWith("Error")
              ? "text-red-400"
              : voteStatus.startsWith("¡")
              ? "text-green-400"
              : "text-yellow-400"
          }`}
        >
          {voteStatus}
        </p>
      )}

      {/* User vote indicator */}
      {hasVoted && !voteStatus && (
        <p className="mt-2 text-xs text-zinc-500">
          Tu voto:{" "}
          <span className="font-medium text-zinc-300">
            {userVote === VoteType.For
              ? "👍 A Favor"
              : userVote === VoteType.Against
              ? "👎 En Contra"
              : "🤷 Abstención"}
          </span>
        </p>
      )}
    </div>
  );
}
