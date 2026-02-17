import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { FORWARDER_ABI } from "@/contracts/abis";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "";
const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { request, signature } = body;

    // Validar campos requeridos
    if (!request || !signature) {
      return NextResponse.json(
        { error: "Missing request or signature" },
        { status: 400 }
      );
    }

    if (
      !request.from ||
      !request.to ||
      request.value === undefined ||
      request.gas === undefined ||
      request.nonce === undefined ||
      !request.data
    ) {
      return NextResponse.json(
        { error: "Invalid forward request format" },
        { status: 400 }
      );
    }

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Relayer not configured" },
        { status: 500 }
      );
    }

    // Conectar al nodo
    const provider = new JsonRpcProvider(RPC_URL);
    const relayerWallet = new Wallet(RELAYER_PRIVATE_KEY, provider);
    const forwarder = new Contract(
      FORWARDER_ADDRESS,
      FORWARDER_ABI,
      relayerWallet
    );

    // Verificar la firma
    const valid = await forwarder.verify(request, signature);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Ejecutar la meta-transacción
    console.log(
      `[Relay] Executing meta-tx from ${request.from} to ${request.to}`
    );
    const tx = await forwarder.execute(request, signature);
    const receipt = await tx.wait();

    console.log(
      `[Relay] Meta-tx executed successfully. Hash: ${receipt.hash}`
    );

    return NextResponse.json({
      success: true,
      hash: receipt.hash,
      from: request.from,
    });
  } catch (error: unknown) {
    console.error("[Relay] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown relay error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
