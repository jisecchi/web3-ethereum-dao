"use client";

import { VoteType } from "@/types/dao";

interface VoteButtonsProps {
  currentVote: VoteType | null;
  hasVoted: boolean;
  onVote: (voteType: VoteType) => void;
  disabled: boolean;
  loading: boolean;
}

export default function VoteButtons({
  currentVote,
  hasVoted,
  onVote,
  disabled,
  loading,
}: VoteButtonsProps) {
  const buttons = [
    {
      type: VoteType.For,
      label: "A Favor",
      emoji: "👍",
      activeClass: "bg-green-600 text-white",
      inactiveClass:
        "border border-green-600/50 text-green-400 hover:bg-green-600/20",
    },
    {
      type: VoteType.Against,
      label: "En Contra",
      emoji: "👎",
      activeClass: "bg-red-600 text-white",
      inactiveClass:
        "border border-red-600/50 text-red-400 hover:bg-red-600/20",
    },
    {
      type: VoteType.Abstain,
      label: "Abstención",
      emoji: "🤷",
      activeClass: "bg-zinc-600 text-white",
      inactiveClass:
        "border border-zinc-600/50 text-zinc-400 hover:bg-zinc-600/20",
    },
  ];

  return (
    <div className="flex gap-2">
      {buttons.map((btn) => {
        const isActive = hasVoted && currentVote === btn.type;
        return (
          <button
            key={btn.type}
            onClick={() => onVote(btn.type)}
            disabled={disabled || loading}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
              isActive ? btn.activeClass : btn.inactiveClass
            }`}
          >
            {loading ? (
              "..."
            ) : (
              <>
                {btn.emoji} {btn.label}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
