/**
 * Server state.
 *
 * Polling rather than sockets (TRD-TCH-006). Nakama supports realtime, but a
 * dashboard that is correct within a minute is sufficient, and polling is
 * dramatically simpler to make correct across flaky school networks — a socket
 * that silently dies leaves a teacher reading a frozen screen with no
 * indication anything is wrong.
 *
 * Polling stops when the tab is hidden. A dashboard left open in a background
 * tab all afternoon would otherwise make ~500 requests for nobody.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { rpc, RpcError } from './nakama';

export type MasteryBand = 'not_started' | 'emerging' | 'developing' | 'proficient' | 'mastered';

export interface ClassSummary {
  generatedAt: string;
  participation: {
    enrolled: number;
    activeThisPeriod: number;
    medianAttempts: number;
    medianMinutes: number;
  };
  heatmap: {
    userId: string;
    displayName: string;
    nodes: {
      skillNodeId: string;
      mastery: number;
      band: MasteryBand;
      evidenceCount: number;
    }[];
  }[];
  gaps: {
    skillNodeId: string;
    studentsBelowProficient: number;
    totalStudents: number;
    suggestedLessonId: string | null;
    suggestedMissionIds: string[];
    /**
     * Authored prose, not a key.
     *
     * The misconception and the first move come from the catalog, reviewed
     * alongside the course material, so a correction reaches a teacher without
     * a dashboard release.
     */
    teaching: { misconception: string; howToTeach: string } | null;
  }[];
  /** Non-null when some students' work has not reached the server yet. */
  unsyncedWarning: { studentsWithStaleData: number } | null;
}

export interface Roster {
  classId: string;
  joinCode: string;
  joinCodeExpiresAt: string | null;
  students: {
    userId: string;
    displayName: string;
    joinedAt: string;
    lastActiveAt: string | null;
    attempts: number;
  }[];
  pendingReclaims: { requestId: string; maskedName: string; requestedAt: string }[];
}

export interface StudentDetail {
  student: {
    userId: string;
    displayName: string;
    joinedAt: string;
    lastActiveAt: string | null;
  };
  summaryText: { strengthKey: string; nextActionKey: string; params: Record<string, string> };
  mastery: {
    skillNodeId: string;
    mastery: number;
    band: MasteryBand;
    evidenceCount: number;
    distinctSources: number;
    trend: 'up' | 'flat' | 'down';
  }[];
  evidence: {
    skillNodeId: string;
    events: {
      at: string;
      missionId: string | null;
      outcome: string;
      hintUsed: boolean;
      masteryBefore: number;
      masteryAfter: number;
    }[];
  }[];
  struggles: { skillNodeId: string; detectedAt: string; resolvedAt: string | null; failures: number }[];
  recentAttempts: {
    attemptId: string;
    missionId: string;
    outcome: string;
    at: string;
    durationMs: number;
    playedOffline: boolean;
  }[];
  points: number;
  streakDays: number;
  certificates: { definitionId: string; issuedAt: string }[];
}

export interface AttentionList {
  students: {
    userId: string;
    displayName: string;
    reason: 'repeated_struggle' | 'activity_drop' | 'stalled' | 'never_started';
    reasonKey: string;
    params: Record<string, string>;
    suggestedAction: { kind: 'assign_mission' | 'assign_lesson' | 'talk'; targetId?: string };
    urgency: number;
  }[];
}

export const queryKeys = {
  classes: ['classes'] as const,
  consent: ['consent'] as const,
  classSummary: (classId: string) => ['class', classId, 'summary'] as const,
  roster: (classId: string) => ['class', classId, 'roster'] as const,
  attention: (classId: string) => ['class', classId, 'attention'] as const,
  student: (classId: string, userId: string) => ['class', classId, 'student', userId] as const,
} as const;

const MINUTE = 60_000;

/**
 * Poll only while somebody is looking.
 *
 * TanStack's `refetchInterval` accepts false to disable, so this is expressed
 * as a value rather than a conditional hook.
 */
function pollWhileVisible(intervalMs: number): number | false {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? false
    : intervalMs;
}

export function useClassSummary(classId: string | null): UseQueryResult<ClassSummary> {
  return useQuery({
    queryKey: queryKeys.classSummary(classId ?? 'none'),
    enabled: classId !== null,
    queryFn: () => rpc<ClassSummary>('v1.teacher.class.summary', { classId }),
    refetchInterval: () => pollWhileVisible(MINUTE),
    refetchIntervalInBackground: false,
    // Keep showing what the teacher was reading when a refetch fails
    // (TRD-TCH-005). A full-screen error would replace a correct-a-minute-ago
    // heatmap with nothing.
    placeholderData: (previous) => previous,
  });
}

/**
 * The roster, polled fast.
 *
 * Five seconds, because during onboarding a teacher is watching thirty
 * students type a code and needs to see them arrive (PRD-TCH-002). Everywhere
 * else this is the wrong interval, so the caller opts in.
 */
export function useRoster(classId: string | null, live = false): UseQueryResult<Roster> {
  return useQuery({
    queryKey: queryKeys.roster(classId ?? 'none'),
    enabled: classId !== null,
    queryFn: () => rpc<Roster>('v1.teacher.class.roster', { classId }),
    refetchInterval: () => pollWhileVisible(live ? 5_000 : 5 * MINUTE),
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useAttention(classId: string | null): UseQueryResult<AttentionList> {
  return useQuery({
    queryKey: queryKeys.attention(classId ?? 'none'),
    enabled: classId !== null,
    queryFn: () => rpc<AttentionList>('v1.teacher.attention.list', { classId }),
    refetchInterval: () => pollWhileVisible(MINUTE),
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useStudentDetail(
  classId: string | null,
  userId: string | null,
): UseQueryResult<StudentDetail> {
  return useQuery({
    queryKey: queryKeys.student(classId ?? 'none', userId ?? 'none'),
    enabled: classId !== null && userId !== null,
    queryFn: () => rpc<StudentDetail>('v1.teacher.student.detail', { classId, userId }),
    // Not polled: a teacher reading one student's evidence is reading, and
    // rows shifting under them mid-sentence helps nobody.
    staleTime: 2 * MINUTE,
  });
}

export function isForbidden(error: unknown): boolean {
  return error instanceof RpcError && error.code === 'FORBIDDEN';
}

export function isOffline(error: unknown): boolean {
  return error instanceof RpcError && (error.code === 'OFFLINE' || error.code === 'UNAVAILABLE');
}
