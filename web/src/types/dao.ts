export interface Proposal {
  id: bigint;
  proposer: string;
  recipient: string;
  amount: bigint;
  deadline: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  votesAbstain: bigint;
  executed: boolean;
  createdAt: bigint;
}

export enum VoteType {
  For = 0,
  Against = 1,
  Abstain = 2,
}

export type ProposalStatus = "active" | "approved" | "rejected" | "executed" | "pending";
