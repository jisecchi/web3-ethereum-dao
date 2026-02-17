// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MinimalForwarder.sol";
import "../src/DAOVoting.sol";

contract DeployDAO is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy MinimalForwarder
        MinimalForwarder forwarder = new MinimalForwarder();
        console.log("MinimalForwarder deployed at:", address(forwarder));

        // 2. Deploy DAOVoting con la dirección del forwarder
        DAOVoting dao = new DAOVoting(address(forwarder));
        console.log("DAOVoting deployed at:", address(dao));

        vm.stopBroadcast();
    }
}
