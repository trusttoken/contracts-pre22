pragma solidity ^0.4.17;

contract MultiOwn {
    struct Proposal {
        mapping(address => bool) votes;
        bool hasCompleted;
    }
    address[] public owners;
    mapping(address => uint) ownersIndices; // starts from 1
    mapping (uint => Proposal) public proposals;
    uint public requiredVoteCount = 2;
    uint public proposalCount = 0;

    struct ChangeOwnershipProposal {
        address from;
        address to;
    }
    mapping (uint => ChangeOwnershipProposal) public changeOwnershipProposals;


    function MultiOwn(address[] _addresses) public {
        for (uint i = 0; i < _addresses.length; i++) {
            addOwner(_addresses[i]);
        }
    }

    // Transfer Ownership logic 
    function proposeChangeOwnership(address _from, address _to) public {
        uint id = proposalCount++;
        changeOwnershipProposals[id] = ChangeOwnershipProposal(_from, _to);
    }

    function changeOwnership(uint _proposalId) private {
        var changeOwnershipProposal = changeOwnershipProposals[_proposalId];
        var from = changeOwnershipProposal.from;
        var to = changeOwnershipProposal.to;

        uint previousIndex = ownersIndices[from];
        ownersIndices[from] = 0;
        owners[previousIndex] = to;
        ownersIndices[to] = ownersIndices[from];
    }

    // Voting Logic
    function voteOnProposal(uint _proposalId, bool _vote) public {
        assert(ownersIndices[msg.sender] != 0);
        proposals[_proposalId].votes[msg.sender] = _vote;
        if (voteCountForProposal(_proposalId) == requiredVoteCount) {
            completeProposal(_proposalId);
        }
    }

    function voteCountForProposal(uint _proposalId) view private returns (uint) {
        uint votes = 0;
        for (uint id = 1; id < owners.length; id++) {
            if (proposals[_proposalId].votes[owners[id]] == true) {
                votes = votes + 1;
            }
        }
        return votes;
    }

    function completeProposal(uint _proposalId) private {
        var hasCompleted = true;
        if (changeOwnershipProposals[_proposalId].to != 0) {
            changeOwnership(_proposalId);
        } else {
            hasCompleted = false;
        }
        proposals[_proposalId].hasCompleted = hasCompleted;
    }

    // Utility methods
    function addOwner(address _owner) private {
        owners.push(_owner);
        ownersIndices[_owner] = owners.length;
    }
}