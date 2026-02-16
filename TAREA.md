# Tarea para Estudiante: DAO con Votación Gasless

## Objetivo del Proyecto

Desarrollar una aplicación completa de DAO (Organización Autónoma Descentralizada) que permita a los usuarios votar propuestas **sin pagar gas**, utilizando meta-transacciones (EIP-2771).

---

## Parte 1: Smart Contracts (Foundry)

### Requisitos Técnicos

Debes implementar dos contratos principales usando Solidity:

#### 1. Contrato MinimalForwarder (EIP-2771)

**Funcionalidad:**
- Actuar como relayer de meta-transacciones
- Validar firmas de usuarios off-chain
- Mantener nonces por usuario para prevenir replay attacks
- Ejecutar llamadas en nombre de usuarios originales

**Métodos requeridos:**
- `verify()`: Validar firma y datos de meta-transacción
- `execute()`: Ejecutar meta-transacción validada
- `getNonce()`: Obtener nonce actual de un usuario

#### 2. Contrato DAO Voting (hereda de ERC2771Context)

**Funcionalidad:**

**Sistema de Propuestas:**
- ID secuencial (1, 2, 3...)
- Monto en ETH a transferir
- Dirección del beneficiario
- Fecha límite de votación
- Contadores de votos: positivos, negativos, abstenciones
- Estado de ejecución

**Sistema de Votación:**
- Requisito: balance mínimo para votar
- Un voto por usuario por propuesta
- Tres tipos de voto: A FAVOR, EN CONTRA, ABSTENCIÓN
- Posibilidad de cambiar voto antes del deadline

**Sistema de Ejecución:**
- Validar: deadline pasado y votos positivos > negativos
- Esperar período adicional de seguridad
- Transferir fondos al beneficiario automáticamente

**Gestión de Fondos:**
- Función payable para recibir ETH
- Tracking del balance total del DAO

**Requisitos de Creación:**
- Solo usuarios con ≥10% del balance total pueden crear propuestas

**Métodos requeridos:**
```solidity
function fundDAO() external payable
function createProposal(address recipient, uint256 amount, uint256 deadline) external
function vote(uint256 proposalId, VoteType voteType) external
function executeProposal(uint256 proposalId) external
function getProposal(uint256 proposalId) external view returns (Proposal memory)
function getUserBalance(address user) external view returns (uint256)
```

### Tareas de Implementación

1. **Configurar proyecto Foundry:**
   ```bash
   forge init sc
   cd sc
   forge install OpenZeppelin/openzeppelin-contracts
   ```

2. **Implementar MinimalForwarder:**
   - Usar estándar EIP-2771
   - Implementar verificación de firmas con ECDSA
   - Gestionar nonces por usuario

3. **Implementar DAO Voting Contract:**
   - Heredar de `ERC2771Context`
   - Implementar todas las funciones requeridas
   - Usar modificadores para validaciones

4. **Escribir tests completos:**
   - Test de creación de propuestas
   - Test de votación (normal y gasless)
   - Test de ejecución de propuestas
   - Test de edge cases (votar dos veces, balance insuficiente, etc.)

5. **Deployment scripts:**
   - Script para desplegar en red local (Anvil)
   - Script para desplegar en testnet

---

## Parte 2: Frontend (Next.js 15)

### Requisitos Técnicos

Desarrollar una aplicación web con Next.js 15 que integre:

#### 1. Conexión con MetaMask

**Funcionalidad:**
- Botón para conectar wallet
- Mostrar dirección conectada
- Mostrar balance del usuario en el DAO

#### 2. Panel de Financiación

**Funcionalidad:**
- Input para cantidad de ETH a depositar
- Botón para enviar fondos al DAO
- Mostrar balance actual del usuario en el DAO
- Mostrar balance total del DAO

#### 3. Creación de Propuestas

**Funcionalidad:**
- Formulario con campos:
  - Dirección del beneficiario
  - Cantidad de ETH
  - Fecha límite de votación
- Validación: solo si usuario tiene ≥10% del balance del DAO
- Feedback visual del estado de la transacción

#### 4. Listado de Propuestas

**Funcionalidad:**
- Card por cada propuesta mostrando:
  - ID de la propuesta
  - Beneficiario y monto
  - Fecha límite
  - Votos actuales (A FAVOR / EN CONTRA / ABSTENCIÓN)
  - Estado (Activa, Aprobada, Rechazada, Ejecutada)
- Botones de votación (si está activa)
- Indicador visual del voto actual del usuario

#### 5. Sistema de Votación Gasless

**Funcionalidad:**
- Generar firma off-chain al votar
- Enviar firma al relayer (API route)
- Mostrar feedback sin requerir confirmación de MetaMask para gas
- Actualizar UI en tiempo real

#### 6. Servicio Relayer (API Route)

**Endpoint:** `/api/relay`

**Funcionalidad:**
- Recibir meta-transacción firmada
- Validar formato y firma
- Enviar transacción al MinimalForwarder
- Pagar gas con cuenta del relayer
- Devolver hash de transacción

#### 7. Daemon de Ejecución

**Funcionalidad:**
- Proceso background que corre cada X segundos
- Verificar propuestas aprobadas con deadline pasado
- Ejecutar automáticamente las propuestas elegibles
- Logging de ejecuciones

### Tareas de Implementación

1. **Setup del proyecto:**
   ```bash
   npx create-next-app@latest web --typescript --tailwind --app
   cd web
   npm install ethers
   ```

2. **Implementar conexión Web3:**
   - Hook personalizado para MetaMask
   - Context provider para estado de wallet
   - Manejo de eventos de cambio de cuenta/red

3. **Implementar componentes UI:**
   - `ConnectWallet.tsx`
   - `FundingPanel.tsx`
   - `CreateProposal.tsx`
   - `ProposalList.tsx`
   - `ProposalCard.tsx`
   - `VoteButtons.tsx`

4. **Implementar lógica de firma:**
   - Función para generar mensaje EIP-712
   - Función para firmar con MetaMask
   - Función para enviar al relayer

5. **Implementar API Route `/api/relay`:**
   - Validar request body
   - Conectar con MinimalForwarder
   - Manejar errores y respuestas

6. **Implementar Daemon:**
   - Puede ser un API route con trigger periódico
   - O un proceso Node.js separado
   - Verificar y ejecutar propuestas

7. **Configuración:**
   - Archivo `.env.local` con:
     ```
     NEXT_PUBLIC_DAO_ADDRESS=0x...
     NEXT_PUBLIC_FORWARDER_ADDRESS=0x...
     NEXT_PUBLIC_CHAIN_ID=31337
     RELAYER_PRIVATE_KEY=0x...
     RELAYER_ADDRESS=0x...
     RPC_URL=http://127.0.0.1:8545
     ```

---

## Parte 3: Integración y Testing

### Flujo Completo a Probar

1. **Setup Inicial:**
   - Iniciar nodo local: `anvil`
   - Desplegar contratos
   - Iniciar frontend: `npm run dev`

2. **Escenario de Prueba:**
   - Usuario A deposita 10 ETH en el DAO
   - Usuario B deposita 5 ETH en el DAO
   - Usuario A crea propuesta (tiene >10% del balance)
   - Usuario B intenta crear propuesta (falla, <10%)
   - Usuario A vota A FAVOR (gasless)
   - Usuario B vota EN CONTRA (gasless)
   - Usuario C deposita 20 ETH
   - Usuario C vota A FAVOR (gasless)
   - Esperar deadline
   - Daemon ejecuta propuesta aprobada
   - Verificar transferencia de fondos

3. **Casos Edge a Validar:**
   - Votar en propuesta inexistente
   - Votar después del deadline
   - Ejecutar propuesta no aprobada
   - Ejecutar propuesta ya ejecutada
   - Cambiar voto antes del deadline
   - Crear propuesta sin balance suficiente

---

## Entregables

### Documentación Requerida

1. **README.md** con:
   - Instrucciones de instalación
   - Comandos para deployment
   - Guía de uso de la aplicación
   - Arquitectura del proyecto

2. **Diagramas:**
   - Flujo de meta-transacciones
   - Arquitectura de contratos
   - Flujo de usuario en frontend

### Código

1. **Repositorio Git** con:
   - Carpeta `sc/` con contratos y tests
   - Carpeta `web/` con frontend
   - Scripts de deployment
   - Archivos de configuración

2. **Tests:**
   - Coverage >80% en contratos
   - Tests de integración frontend-backend

### Demo

- Video o presentación demostrando:
  - Creación de propuesta
  - Votación gasless
  - Ejecución automática
  - Manejo de errores

---

## Criterios de Evaluación

| Criterio | Puntos | Descripción |
|----------|--------|-------------|
| **Smart Contracts** | 40% | Implementación correcta, tests completos, seguridad |
| **Frontend** | 30% | UI/UX, integración Web3, manejo de estados |
| **Meta-Transacciones** | 20% | Implementación gasless, relayer funcional |
| **Documentación** | 10% | Claridad, completitud, diagramas |

---

## Recursos Adicionales

- [EIP-2771 Standard](https://eips.ethereum.org/EIPS/eip-2771)
- [Foundry Book](https://book.getfoundry.sh/)
- [Next.js 15 Docs](https://nextjs.org/docs)
- [ethers.js Documentation](https://docs.ethers.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## Tiempo Estimado usando IA

- **Estudio del proyecto:** 0.5 dia.
- **Smart Contracts:** 0.5 dia.
- **Frontend:** 2 dias
- **Integración y Testing:** 1 dia
- **Documentación:** 1 dia

**Total:** 5 dias

---

## Consejos

1. Empieza por los contratos y tests antes del frontend
2. Usa Anvil para development local rápido
3. Implementa logging extensivo en el relayer
4. Testea el flujo gasless exhaustivamente
5. Considera gas optimization en los contratos
6. Maneja errores de red y wallet desconectado
7. Usa TypeScript para type safety
8. Documenta decisiones de diseño importantes

---

**¡Buena suerte con el proyecto!** 🚀