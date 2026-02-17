export const config = {
  daoAddress: process.env.NEXT_PUBLIC_DAO_ADDRESS || "",
  forwarderAddress: process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || "",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337"),
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
};
