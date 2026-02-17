# DAO Voting - dApp con Votación Gasless (EIP-2771)

Aplicación completa de DAO (Organización Autónoma Descentralizada) que permite crear propuestas, votar **sin pagar gas** mediante meta-transacciones (EIP-2771), y ejecutar propuestas aprobadas automáticamente.

---

## Arquitectura

```
web3-ethereum-dao/
├── contracts/              # Smart Contracts (Foundry)
│   ├── src/
│   │   ├── MinimalForwarder.sol   # Relayer EIP-2771
│   │   └── DAOVoting.sol          # Contrato principal DAO
│   ├── test/
│   │   └── DAOVoting.t.sol        # Tests completos
│   ├── script/
│   │   └── DeployDAO.s.sol        # Script de deployment
│   └── foundry.toml
├── web/                    # Frontend (Next.js 15)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Página principal
│   │   │   ├── layout.tsx         # Layout con Web3Provider
│   │   │   └── api/
│   │   │       ├── relay/route.ts          # Servicio relayer
│   │   │       └── execute-daemon/route.ts # Daemon de ejecución
│   │   ├── components/
│   │   │   ├── ConnectWallet.tsx
│   │   │   ├── FundingPanel.tsx
│   │   │   ├── CreateProposal.tsx
│   │   │   ├── ProposalList.tsx
│   │   │   ├── ProposalCard.tsx
│   │   │   └── VoteButtons.tsx
│   │   ├── context/
│   │   │   └── Web3Context.tsx    # Provider global Web3
│   │   ├── contracts/
│   │   │   ├── abis.ts            # ABIs de los contratos
│   │   │   └── config.ts          # Configuración
│   │   └── types/
│   │       ├── dao.ts
│   │       └── ethereum.d.ts
│   └── .env.example
└── deploy.sh               # Script de deployment automático
```

---

## Flujo de Meta-Transacciones

```
Usuario                Frontend           Relayer (API)        Blockchain
  │                      │                    │                    │
  │─ Vota gasless ──────>│                    │                    │
  │                      │─ Firma EIP-712 ──>│                    │
  │  ← MetaMask popup ──│                    │                    │
  │─ Firma ─────────────>│                    │                    │
  │                      │─ POST /api/relay ─>│                    │
  │                      │                    │─ execute() ──────>│
  │                      │                    │  (paga gas)       │
  │                      │                    │  ← receipt ───────│
  │                      │  ← hash ──────────│                    │
  │  ← Confirmación ────│                    │                    │
```

---

## Instalación

### Requisitos previos

- Node.js ≥ 18
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- MetaMask (extensión de navegador)

### 1. Clonar e instalar dependencias

```bash
# Instalar dependencias de contratos
cd contracts
forge install

# Instalar dependencias del frontend
cd ../web
npm install
```

### 2. Ejecutar tests de contratos

```bash
cd contracts
forge test -v
```

---

## Deployment (Red Local)

### 1. Iniciar Anvil

```bash
anvil
```

### 2. Desplegar contratos

Opción A — Script automático (recomendado):

```bash
./deploy.sh
```

Opción B — Manual:

```bash
cd contracts
forge script script/DeployDAO.s.sol:DeployDAO \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Copia las direcciones desplegadas y crea `web/.env.local`:

```env
NEXT_PUBLIC_DAO_ADDRESS=0x...
NEXT_PUBLIC_FORWARDER_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=31337
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
```

### 3. Iniciar Frontend

```bash
cd web
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### 4. Configurar MetaMask

1. Añadir red personalizada:
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Símbolo:** ETH
2. Importar cuentas de Anvil (usando las claves privadas mostradas al iniciar Anvil)

---

## Uso de la Aplicación

1. **Conectar Wallet** — Pulsa "Conectar Wallet" en la cabecera
2. **Depositar fondos** — Ingresa una cantidad de ETH y pulsa "Depositar"
3. **Crear propuesta** — Necesitas ≥10% del balance total de la DAO
4. **Votar** — Pulsa A Favor / En Contra / Abstención (sin gas, firma con MetaMask)
5. **Ejecución** — Las propuestas aprobadas se ejecutan automáticamente por el daemon

### Daemon de Ejecución

El daemon se invoca periódicamente vía:

```
GET /api/execute-daemon
```

Puedes configurar un cron o llamarlo manualmente:

```bash
curl http://localhost:3000/api/execute-daemon
```

---

## Smart Contracts

### MinimalForwarder

- Relayer de meta-transacciones (EIP-2771)
- Valida firmas EIP-712 off-chain
- Gestiona nonces por usuario para prevenir replay attacks
- Ejecuta llamadas en nombre de los usuarios originales

### DAOVoting

- Hereda de `ERC2771Context` de OpenZeppelin
- Sistema de propuestas con ID secuencial
- Votación con 3 tipos: A FAVOR, EN CONTRA, ABSTENCIÓN
- Posibilidad de cambiar voto antes del deadline
- Período de seguridad antes de ejecución (1 día)
- Requisito: ≥10% del balance total para crear propuestas
- Balance mínimo requerido para votar

---

## Tests

Los tests cubren:

- Financiación de la DAO (depositar ETH, recibir ETH)
- Creación de propuestas (válida, balance insuficiente, parámetros inválidos)
- Votación normal y gasless (a favor, en contra, abstención, cambio de voto)
- Ejecución de propuestas (aprobada, rechazada, pre-deadline, ya ejecutada)
- MinimalForwarder (nonces, verificación de firmas, incremento de nonces)
- Escenario completo end-to-end

```bash
forge test -v    # Todos los tests
forge test --mt test_VoteGasless -vvv  # Test específico con detalle
```

---

## Tecnologías

- **Solidity** ^0.8.20 — Smart contracts
- **Foundry** — Compilación, tests y deployment
- **OpenZeppelin** — ERC2771Context, ECDSA, EIP712
- **Next.js 15** — Frontend con App Router
- **ethers.js v6** — Interacción con blockchain
- **Tailwind CSS v4** — Estilos
- **TypeScript** — Type safety
