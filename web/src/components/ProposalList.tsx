"use client";

import { useState, useEffect, useCallback } from "react";
import { Contract } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import { config } from "@/contracts/config";
import { DAO_ABI } from "@/contracts/abis";
import { Proposal } from "@/types/dao";
import ProposalCard from "./ProposalCard";

export default function ProposalList() {
  const { account, provider } = useWeb3();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProposals = useCallback(async () => {
    if (!provider || !config.daoAddress) return;
    setLoading(true);
    try {
      const dao = new Contract(config.daoAddress, DAO_ABI, provider);
      const count = await dao.proposalCount();
      const total = Number(count);

      const proposalPromises = [];
      for (let i = 1; i <= total; i++) {
        proposalPromises.push(dao.getProposal(i));
      }
      const results = await Promise.all(proposalPromises);

      const mapped: Proposal[] = results.map((p) => ({
        id: p.id,
        proposer: p.proposer,
        recipient: p.recipient,
        amount: p.amount,
        deadline: p.deadline,
        votesFor: p.votesFor,
        votesAgainst: p.votesAgainst,
        votesAbstain: p.votesAbstain,
        executed: p.executed,
        createdAt: p.createdAt,
      }));

      setProposals(mapped.reverse()); // newest first
    } catch (err) {
      console.error("Error fetching proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchProposals, 15000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  if (!account) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          📋 Propuestas ({proposals.length})
        </h2>
        <button
          onClick={fetchProposals}
          disabled={loading}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "🔄 Refrescar"}
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">No hay propuestas aún.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Crea una nueva propuesta para comenzar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={Number(proposal.id)}
              proposal={proposal}
              onRefresh={fetchProposals}
            />
          ))}
        </div>
      )}
    </div>
  );
}
