#!/bin/bash
# Script para desplegar contratos en Anvil (red local) y configurar el frontend

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WEB_DIR="$ROOT_DIR/web"

# Cuenta 0 de Anvil (default deployer/relayer)
ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RPC_URL="http://127.0.0.1:8545"

echo "🚀 Desplegando contratos en Anvil..."

cd "$CONTRACTS_DIR"

# Deploy y capturar output
DEPLOY_OUTPUT=$(forge script script/DeployDAO.s.sol:DeployDAO \
  --rpc-url $RPC_URL \
  --private-key $ANVIL_PRIVATE_KEY \
  --broadcast 2>&1)

echo "$DEPLOY_OUTPUT"

# Extraer direcciones
FORWARDER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "MinimalForwarder deployed at:" | awk '{print $NF}')
DAO_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "DAOVoting deployed at:" | awk '{print $NF}')

if [ -z "$FORWARDER_ADDRESS" ] || [ -z "$DAO_ADDRESS" ]; then
  echo "❌ Error: No se pudieron extraer las direcciones de los contratos"
  exit 1
fi

echo ""
echo "✅ Contratos desplegados:"
echo "   MinimalForwarder: $FORWARDER_ADDRESS"
echo "   DAOVoting:        $DAO_ADDRESS"

# Crear .env.local para el frontend
cat > "$WEB_DIR/.env.local" << EOF
# Generado automáticamente por deploy.sh
NEXT_PUBLIC_DAO_ADDRESS=$DAO_ADDRESS
NEXT_PUBLIC_FORWARDER_ADDRESS=$FORWARDER_ADDRESS
NEXT_PUBLIC_CHAIN_ID=31337

RELAYER_PRIVATE_KEY=$ANVIL_PRIVATE_KEY
RPC_URL=$RPC_URL
EOF

echo ""
echo "✅ Archivo web/.env.local creado"
echo ""
echo "📝 Próximos pasos:"
echo "   1. cd web && npm run dev"
echo "   2. Abre http://localhost:3000"
echo "   3. Conecta MetaMask a la red Anvil (localhost:8545, chainId: 31337)"
