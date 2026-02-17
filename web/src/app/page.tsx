"use client";

import ConnectWallet from "@/components/ConnectWallet";
import FundingPanel from "@/components/FundingPanel";
import CreateProposal from "@/components/CreateProposal";
import ProposalList from "@/components/ProposalList";
import { useWeb3 } from "@/context/Web3Context";

export default function Home() {
  const { account } = useWeb3();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <div>
              <h1 className="text-lg font-bold text-white">DAO Voting</h1>
              <p className="text-xs text-zinc-500">Votación Gasless (EIP-2771)</p>
            </div>
          </div>
          <ConnectWallet />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {!account ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <span className="mb-4 text-6xl">🏛️</span>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Bienvenido a la DAO
            </h2>
            <p className="mb-6 max-w-md text-zinc-400">
              Conecta tu wallet para participar en la gobernanza de la DAO.
              Deposita fondos, crea propuestas y vota sin pagar gas.
            </p>
            <ConnectWallet />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top section: Fund + Create */}
            <div className="grid gap-6 lg:grid-cols-2">
              <FundingPanel />
              <CreateProposal />
            </div>

            {/* Proposals */}
            <ProposalList />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-600">
        DAO Voting dApp — Meta-transacciones EIP-2771
      </footer>
    </div>
  );
}
