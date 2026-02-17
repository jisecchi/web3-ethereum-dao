import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { DAO_ABI } from "@/contracts/abis";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "";
const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS || "";

/**
 * Daemon de ejecución: verifica propuestas aprobadas con deadline pasado
 * y las ejecuta automáticamente.
 *
 * Se invoca periódicamente vía GET /api/execute-daemon
 */
export async function GET() {
  try {
    if (!RELAYER_PRIVATE_KEY || !DAO_ADDRESS) {
      return NextResponse.json(
        { error: "Daemon not configured" },
        { status: 500 }
      );
    }

    const provider = new JsonRpcProvider(RPC_URL);
    const wallet = new Wallet(RELAYER_PRIVATE_KEY, provider);
    const dao = new Contract(DAO_ADDRESS, DAO_ABI, wallet);

    const proposalCount = await dao.proposalCount();
    const total = Number(proposalCount);
    const now = Math.floor(Date.now() / 1000);
    const executionDelay = Number(await dao.EXECUTION_DELAY());

    const results: { id: number; status: string; hash?: string; error?: string }[] = [];

    console.log(`[Daemon] Checking ${total} proposals...`);

    for (let i = 1; i <= total; i++) {
      try {
        const proposal = await dao.getProposal(i);

        // Skip already executed
        if (proposal.executed) {
          continue;
        }

        const deadline = Number(proposal.deadline);

        // Skip if deadline not passed
        if (now < deadline) {
          continue;
        }

        // Skip if not approved (votesFor must be > votesAgainst)
        if (proposal.votesFor <= proposal.votesAgainst) {
          results.push({ id: i, status: "rejected" });
          continue;
        }

        // Skip if execution delay not met
        if (now < deadline + executionDelay) {
          results.push({
            id: i,
            status: "waiting_delay",
            error: `Ready at ${new Date((deadline + executionDelay) * 1000).toISOString()}`,
          });
          continue;
        }

        // Execute the proposal
        console.log(`[Daemon] Executing proposal #${i}...`);
        const tx = await dao.executeProposal(i);
        const receipt = await tx.wait();
        console.log(`[Daemon] Proposal #${i} executed. Hash: ${receipt.hash}`);

        results.push({ id: i, status: "executed", hash: receipt.hash });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        console.error(`[Daemon] Error executing proposal #${i}:`, message);
        results.push({ id: i, status: "error", error: message });
      }
    }

    return NextResponse.json({
      success: true,
      checked: total,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[Daemon] Fatal error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown daemon error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
