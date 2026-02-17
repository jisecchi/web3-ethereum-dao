// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title DAOVoting
 * @notice Contrato de votación para una DAO con soporte de meta-transacciones (EIP-2771).
 *         Permite crear propuestas, votar (gasless) y ejecutar transferencias de fondos.
 */
contract DAOVoting is ERC2771Context {
    // ─── Tipos ─────────────────────────────────────────────
    enum VoteType {
        For,
        Against,
        Abstain
    }

    struct Proposal {
        uint256 id;
        address proposer;
        address recipient;
        uint256 amount;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votesAbstain;
        bool executed;
        uint256 createdAt;
    }

    // ─── Estado ────────────────────────────────────────────
    uint256 public proposalCount;
    uint256 public totalDAOBalance;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant MIN_BALANCE_PERCENT = 10; // 10% del balance total

    mapping(uint256 => Proposal) private _proposals;
    mapping(address => uint256) private _balances;
    // proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    // proposalId => voter => voteType
    mapping(uint256 => mapping(address => VoteType)) private _votes;

    // ─── Eventos ───────────────────────────────────────────
    event DAOFunded(address indexed funder, uint256 amount);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address recipient,
        uint256 amount,
        uint256 deadline
    );
    event Voted(uint256 indexed proposalId, address indexed voter, VoteType voteType);
    event VoteChanged(uint256 indexed proposalId, address indexed voter, VoteType oldVote, VoteType newVote);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);

    // ─── Errores ───────────────────────────────────────────
    error InsufficientBalance(uint256 required, uint256 actual);
    error ProposalNotFound(uint256 proposalId);
    error ProposalExpired(uint256 proposalId);
    error ProposalNotExpired(uint256 proposalId);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalNotApproved(uint256 proposalId);
    error ExecutionDelayNotMet(uint256 proposalId, uint256 readyAt);
    error InsufficientDAOFunds(uint256 required, uint256 available);
    error InvalidDeadline();
    error InvalidAmount();
    error InvalidRecipient();

    // ─── Constructor ───────────────────────────────────────
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    // ─── Modificadores ─────────────────────────────────────
    modifier proposalExists(uint256 proposalId) {
        if (proposalId == 0 || proposalId > proposalCount) {
            revert ProposalNotFound(proposalId);
        }
        _;
    }

    modifier proposalActive(uint256 proposalId) {
        if (block.timestamp >= _proposals[proposalId].deadline) {
            revert ProposalExpired(proposalId);
        }
        _;
    }

    modifier proposalEnded(uint256 proposalId) {
        if (block.timestamp < _proposals[proposalId].deadline) {
            revert ProposalNotExpired(proposalId);
        }
        _;
    }

    // ─── Funciones públicas ────────────────────────────────

    /// @notice Depositar ETH en la DAO
    function fundDAO() external payable {
        require(msg.value > 0, "Must send ETH");
        _balances[_msgSender()] += msg.value;
        totalDAOBalance += msg.value;
        emit DAOFunded(_msgSender(), msg.value);
    }

    /// @notice Crear una nueva propuesta
    /// @param recipient Dirección que recibirá los fondos
    /// @param amount Cantidad de ETH a transferir (en wei)
    /// @param deadline Timestamp Unix del fin de la votación
    function createProposal(
        address recipient,
        uint256 amount,
        uint256 deadline
    ) external {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        address sender = _msgSender();
        uint256 requiredBalance = (totalDAOBalance * MIN_BALANCE_PERCENT) / 100;
        if (_balances[sender] < requiredBalance) {
            revert InsufficientBalance(requiredBalance, _balances[sender]);
        }

        proposalCount++;
        _proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: sender,
            recipient: recipient,
            amount: amount,
            deadline: deadline,
            votesFor: 0,
            votesAgainst: 0,
            votesAbstain: 0,
            executed: false,
            createdAt: block.timestamp
        });

        emit ProposalCreated(proposalCount, sender, recipient, amount, deadline);
    }

    /// @notice Votar en una propuesta (soporta meta-transacciones)
    /// @param proposalId ID de la propuesta
    /// @param voteType Tipo de voto: For, Against o Abstain
    function vote(
        uint256 proposalId,
        VoteType voteType
    ) external proposalExists(proposalId) proposalActive(proposalId) {
        address voter = _msgSender();
        require(_balances[voter] > 0, "Must have balance to vote");

        Proposal storage proposal = _proposals[proposalId];

        if (_hasVoted[proposalId][voter]) {
            // Cambiar voto: restar voto anterior
            VoteType oldVote = _votes[proposalId][voter];
            _removeVote(proposal, oldVote);
            _addVote(proposal, voteType);
            _votes[proposalId][voter] = voteType;
            emit VoteChanged(proposalId, voter, oldVote, voteType);
        } else {
            _hasVoted[proposalId][voter] = true;
            _votes[proposalId][voter] = voteType;
            _addVote(proposal, voteType);
            emit Voted(proposalId, voter, voteType);
        }
    }

    /// @notice Ejecutar una propuesta aprobada después del período de seguridad
    /// @param proposalId ID de la propuesta
    function executeProposal(
        uint256 proposalId
    ) external proposalExists(proposalId) proposalEnded(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.executed) revert ProposalAlreadyExecuted(proposalId);
        if (proposal.votesFor <= proposal.votesAgainst) revert ProposalNotApproved(proposalId);

        uint256 readyAt = proposal.deadline + EXECUTION_DELAY;
        if (block.timestamp < readyAt) {
            revert ExecutionDelayNotMet(proposalId, readyAt);
        }

        if (address(this).balance < proposal.amount) {
            revert InsufficientDAOFunds(proposal.amount, address(this).balance);
        }

        proposal.executed = true;
        totalDAOBalance -= proposal.amount;

        (bool success, ) = proposal.recipient.call{value: proposal.amount}("");
        require(success, "Transfer failed");

        emit ProposalExecuted(proposalId, proposal.recipient, proposal.amount);
    }

    /// @notice Obtener información de una propuesta
    function getProposal(uint256 proposalId) external view proposalExists(proposalId) returns (Proposal memory) {
        return _proposals[proposalId];
    }

    /// @notice Obtener el balance de un usuario en la DAO
    function getUserBalance(address user) external view returns (uint256) {
        return _balances[user];
    }

    /// @notice Verificar si un usuario ya votó en una propuesta
    function hasUserVoted(uint256 proposalId, address user) external view returns (bool) {
        return _hasVoted[proposalId][user];
    }

    /// @notice Obtener el voto de un usuario en una propuesta
    function getUserVote(uint256 proposalId, address user) external view returns (VoteType) {
        return _votes[proposalId][user];
    }

    /// @notice Recibir ETH directamente
    receive() external payable {
        _balances[msg.sender] += msg.value;
        totalDAOBalance += msg.value;
        emit DAOFunded(msg.sender, msg.value);
    }

    // ─── Funciones internas ────────────────────────────────

    function _addVote(Proposal storage proposal, VoteType voteType) internal {
        if (voteType == VoteType.For) {
            proposal.votesFor++;
        } else if (voteType == VoteType.Against) {
            proposal.votesAgainst++;
        } else {
            proposal.votesAbstain++;
        }
    }

    function _removeVote(Proposal storage proposal, VoteType voteType) internal {
        if (voteType == VoteType.For) {
            proposal.votesFor--;
        } else if (voteType == VoteType.Against) {
            proposal.votesAgainst--;
        } else {
            proposal.votesAbstain--;
        }
    }
}
