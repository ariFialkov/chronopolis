import type { NpcArchetype } from '../eras/types';

export type QuestStep =
  | {
      kind: 'talk';
      era: string;
      npcId: string;
      name: string;
      role: string;
      x: number;
      z: number;
      lines: string[];
      look?: Partial<NpcArchetype>;
      objective: string;
    }
  | {
      kind: 'read';
      era: string;
      objectId: string;
      name: string;
      x: number;
      z: number;
      lines: string[];
      objective: string;
    }
  | { kind: 'goto'; era: string; x: number; z: number; radius: number; objective: string; label: string }
  | { kind: 'findPort'; port: string; objective: string }
  | { kind: 'travel'; era: string; objective: string };

export interface Quest {
  id: string;
  act: number;
  title: string;
  /** Shown in the journal. */
  summary: string;
  /** Quest ids that must be complete before this one becomes available. */
  requires: string[];
  /** Minimum number of insights required (for the finale). */
  requiresInsights?: number;
  steps: QuestStep[];
  /** Insight awarded (era id) on completion. */
  insight?: string;
  /** Chronoport hints revealed on completion. */
  revealHints?: string[];
  /** Flags set on completion. */
  flags?: string[];
  /** Message shown on completion. */
  completeText?: string;
}

export interface QuestState {
  completed: string[];
  stepIndex: Record<string, number>;
}
