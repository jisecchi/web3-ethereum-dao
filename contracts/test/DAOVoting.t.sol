// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DAOVoting.sol";

contract DAOVotingTest is Test {
    MinimalForwarder public forwarder;
    DAOVoting public dao;

    address public userA;
    uint256 public userAKey;
    address public userB;
    uint256 public userBKey;
    address public userC;
    uint256 public userCKey;
    address public recipient;

    // EIP-712 domain separator values para MinimalForwarder
    bytes32 constant FORWARD_REQUEST_TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    function setUp() public {
        // Crear cuentas de prueba
        (userA, userAKey) = makeAddrAndKey("userA");
        (userB, userBKey) = makeAddrAndKey("userB");
        (userC, userCKey) = makeAddrAndKey("userC");
        recipient = makeAddr("recipient");

        // Dar ETH a las cuentas
        vm.deal(userA, 100 ether);
        vm.deal(userB, 100 ether);
        vm.deal(userC, 100 ether);

        // Deplegar contratos
        forwarder = new MinimalForwarder();
        dao = new DAOVoting(address(forwarder));
    }

    // ─── Tests de Financiación ─────────────────────────────

    function test_FundDAO() public {
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();

        assertEq(dao.getUserBalance(userA), 10 ether);
        assertEq(dao.totalDAOBalance(), 10 ether);
        assertEq(address(dao).balance, 10 ether);
    }

    function test_FundDAO_Multiple() public {
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();

        vm.prank(userB);
        dao.fundDAO{value: 5 ether}();

        assertEq(dao.getUserBalance(userA), 10 ether);
        assertEq(dao.getUserBalance(userB), 5 ether);
        assertEq(dao.totalDAOBalance(), 15 ether);
    }

    function test_FundDAO_RevertZero() public {
        vm.prank(userA);
        vm.expectRevert("Must send ETH");
        dao.fundDAO{value: 0}();
    }

    function test_ReceiveETH() public {
        vm.prank(userA);
        (bool success, ) = address(dao).call{value: 5 ether}("");
        assertTrue(success);
        assertEq(dao.getUserBalance(userA), 5 ether);
        assertEq(dao.totalDAOBalance(), 5 ether);
    }

    // ─── Tests de Creación de Propuestas ───────────────────

    function test_CreateProposal() public {
        _fundUserA();

        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.id, 1);
        assertEq(p.proposer, userA);
        assertEq(p.recipient, recipient);
        assertEq(p.amount, 1 ether);
        assertEq(p.votesFor, 0);
        assertEq(p.votesAgainst, 0);
        assertEq(p.votesAbstain, 0);
        assertFalse(p.executed);
    }

    function test_CreateProposal_InsufficientBalance() public {
        // UserA deposita 10, UserB deposita 100
        // UserA tiene < 10% del total (10/110 ≈ 9%)
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();
        vm.prank(userB);
        dao.fundDAO{value: 100 ether}();

        vm.prank(userA);
        vm.expectRevert();
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);
    }

    function test_CreateProposal_ExactlyTenPercent() public {
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();
        vm.prank(userB);
        dao.fundDAO{value: 90 ether}();

        // userA tiene exactamente 10%
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);

        assertEq(dao.proposalCount(), 1);
    }

    function test_CreateProposal_InvalidRecipient() public {
        _fundUserA();

        vm.prank(userA);
        vm.expectRevert(DAOVoting.InvalidRecipient.selector);
        dao.createProposal(address(0), 1 ether, block.timestamp + 1 days);
    }

    function test_CreateProposal_InvalidAmount() public {
        _fundUserA();

        vm.prank(userA);
        vm.expectRevert(DAOVoting.InvalidAmount.selector);
        dao.createProposal(recipient, 0, block.timestamp + 1 days);
    }

    function test_CreateProposal_InvalidDeadline() public {
        _fundUserA();

        vm.prank(userA);
        vm.expectRevert(DAOVoting.InvalidDeadline.selector);
        dao.createProposal(recipient, 1 ether, block.timestamp - 1);
    }

    function test_CreateProposal_Sequential() public {
        _fundUserA();

        vm.startPrank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);
        dao.createProposal(recipient, 2 ether, block.timestamp + 2 days);
        dao.createProposal(recipient, 3 ether, block.timestamp + 3 days);
        vm.stopPrank();

        assertEq(dao.proposalCount(), 3);
        assertEq(dao.getProposal(1).amount, 1 ether);
        assertEq(dao.getProposal(2).amount, 2 ether);
        assertEq(dao.getProposal(3).amount, 3 ether);
    }

    // ─── Tests de Votación (Normal) ────────────────────────

    function test_VoteFor() public {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesFor, 1);
        assertEq(p.votesAgainst, 0);
        assertEq(p.votesAbstain, 0);
        assertTrue(dao.hasUserVoted(1, userA));
    }

    function test_VoteAgainst() public {
        _setupProposal();

        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.Against);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesFor, 0);
        assertEq(p.votesAgainst, 1);
    }

    function test_VoteAbstain() public {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.Abstain);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesAbstain, 1);
    }

    function test_ChangeVote() public {
        _setupProposal();

        vm.startPrank(userA);
        dao.vote(1, DAOVoting.VoteType.For);
        dao.vote(1, DAOVoting.VoteType.Against);
        vm.stopPrank();

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesFor, 0);
        assertEq(p.votesAgainst, 1);
    }

    function test_VoteOnInexistentProposal() public {
        _fundUserA();

        vm.prank(userA);
        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalNotFound.selector, 999));
        dao.vote(999, DAOVoting.VoteType.For);
    }

    function test_VoteAfterDeadline() public {
        _setupProposal();

        // Avanzar tiempo más allá del deadline
        vm.warp(block.timestamp + 2 days);

        vm.prank(userA);
        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalExpired.selector, 1));
        dao.vote(1, DAOVoting.VoteType.For);
    }

    function test_VoteWithoutBalance() public {
        _setupProposal();

        address noBalance = makeAddr("noBalance");
        vm.prank(noBalance);
        vm.expectRevert("Must have balance to vote");
        dao.vote(1, DAOVoting.VoteType.For);
    }

    // ─── Tests de Votación Gasless (Meta-transacciones) ────

    function test_VoteGasless() public {
        _setupProposal();

        // Construir meta-transacción para votar
        bytes memory voteData = abi.encodeWithSelector(
            DAOVoting.vote.selector,
            uint256(1),
            DAOVoting.VoteType.For
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userA,
            to: address(dao),
            value: 0,
            gas: 1_000_000,
            nonce: forwarder.getNonce(userA),
            data: voteData
        });

        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userAKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Ejecutar via forwarder (relayer paga gas)
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesFor, 1);
        assertTrue(dao.hasUserVoted(1, userA));
    }

    function test_VoteGasless_InvalidSignature() public {
        _setupProposal();

        bytes memory voteData = abi.encodeWithSelector(
            DAOVoting.vote.selector,
            uint256(1),
            DAOVoting.VoteType.For
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userA,
            to: address(dao),
            value: 0,
            gas: 1_000_000,
            nonce: forwarder.getNonce(userA),
            data: voteData
        });

        // Firmar con clave incorrecta (userB firma como si fuera userA)
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userBKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("MinimalForwarder: signature does not match request");
        forwarder.execute(req, signature);
    }

    // ─── Tests de Ejecución ────────────────────────────────

    function test_ExecuteProposal() public {
        _setupApprovedProposal();

        uint256 recipientBalanceBefore = recipient.balance;

        dao.executeProposal(1);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertTrue(p.executed);
        assertEq(recipient.balance, recipientBalanceBefore + 1 ether);
    }

    function test_ExecuteProposal_NotApproved() public {
        _setupProposal();

        // Solo votan en contra
        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.Against);
        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.Against);

        // Pasar deadline + delay
        vm.warp(block.timestamp + 2 days);

        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalNotApproved.selector, 1));
        dao.executeProposal(1);
    }

    function test_ExecuteProposal_TiedVotes() public {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);
        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.Against);

        // Pasar deadline + delay
        vm.warp(block.timestamp + 2 days);

        // Empate: votesFor no es > votesAgainst
        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalNotApproved.selector, 1));
        dao.executeProposal(1);
    }

    function test_ExecuteProposal_BeforeDeadline() public {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);

        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalNotExpired.selector, 1));
        dao.executeProposal(1);
    }

    function test_ExecuteProposal_BeforeDelay() public {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);

        // Pasar deadline pero no el delay
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectRevert();
        dao.executeProposal(1);
    }

    function test_ExecuteProposal_AlreadyExecuted() public {
        _setupApprovedProposal();

        dao.executeProposal(1);

        vm.expectRevert(abi.encodeWithSelector(DAOVoting.ProposalAlreadyExecuted.selector, 1));
        dao.executeProposal(1);
    }

    // ─── Tests de MinimalForwarder ─────────────────────────

    function test_ForwarderNonce() public view {
        assertEq(forwarder.getNonce(userA), 0);
    }

    function test_ForwarderNonceIncrement() public {
        _setupProposal();

        bytes memory voteData = abi.encodeWithSelector(
            DAOVoting.vote.selector,
            uint256(1),
            DAOVoting.VoteType.For
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userA,
            to: address(dao),
            value: 0,
            gas: 1_000_000,
            nonce: 0,
            data: voteData
        });

        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userAKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        forwarder.execute(req, signature);
        assertEq(forwarder.getNonce(userA), 1);
    }

    function test_ForwarderVerify() public {
        bytes memory data = abi.encodeWithSelector(DAOVoting.vote.selector, uint256(1), DAOVoting.VoteType.For);

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userA,
            to: address(dao),
            value: 0,
            gas: 1_000_000,
            nonce: 0,
            data: data
        });

        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userAKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        assertTrue(forwarder.verify(req, signature));
    }

    // ─── Tests de Escenario Completo ───────────────────────

    function test_FullScenario() public {
        // 1. UserA deposita 10 ETH, UserB deposita 0.5 ETH
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();
        vm.prank(userB);
        dao.fundDAO{value: 0.5 ether}();

        assertEq(dao.totalDAOBalance(), 10.5 ether);

        // 2. UserA crea propuesta (tiene >10%)
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);

        // 3. UserB no puede crear propuesta (<10% de 10.5 ETH = 1.05 ETH, B tiene 0.5)
        vm.prank(userB);
        vm.expectRevert();
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);

        // 4. UserA vota A FAVOR
        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);

        // 5. UserB vota EN CONTRA
        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.Against);

        // 6. UserC deposita 20 ETH y vota A FAVOR
        vm.prank(userC);
        dao.fundDAO{value: 20 ether}();
        vm.prank(userC);
        dao.vote(1, DAOVoting.VoteType.For);

        // 7. Verificar votos
        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.votesFor, 2);
        assertEq(p.votesAgainst, 1);

        // 8. Esperar deadline + delay
        vm.warp(block.timestamp + 2 days);

        // 9. Ejecutar propuesta
        uint256 balBefore = recipient.balance;
        dao.executeProposal(1);

        // 10. Verificar
        assertEq(recipient.balance, balBefore + 1 ether);
        assertTrue(dao.getProposal(1).executed);
    }

    // ─── Helpers ───────────────────────────────────────────

    function _fundUserA() internal {
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();
    }

    function _setupProposal() internal {
        vm.prank(userA);
        dao.fundDAO{value: 10 ether}();
        vm.prank(userB);
        dao.fundDAO{value: 5 ether}();

        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days);
    }

    function _setupApprovedProposal() internal {
        _setupProposal();

        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.For);
        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.For);

        // Pasar deadline + execution delay
        vm.warp(block.timestamp + 2 days);
    }

    function _getDigest(MinimalForwarder.ForwardRequest memory req) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                FORWARD_REQUEST_TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );

        // Reconstruct EIP-712 domain separator
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MinimalForwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(forwarder)
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
