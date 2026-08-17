/**
 * Assigning work.
 *
 * `v1.teacher.assignment.create` has existed, authorised and tested, with
 * nothing calling it — and `v1.sync.pull`, the only channel that carries an
 * assignment to a device, had no caller either. The feature was complete on
 * both sides and connected to nothing.
 *
 * **There is no generic assign form here, and that is deliberate.** The RPC
 * takes a `targetId`, which is a mission or lesson id like `congklak.m04`. A
 * teacher never sees those — the dashboard renders them as translated names —
 * so a form asking for one would be unfillable by the person it was for.
 *
 * Instead the button appears where the product already knows what to assign:
 * next to a gap, which carries a suggested lesson, and next to a student in the
 * attention list, whose suggested action carries a target. In both places the
 * assignment is the obvious next step from something the teacher is already
 * reading, which is the only moment they have time for it.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { rpc } from '../../data/nakama';
import { queryKeys } from '../../data/queries';
import styles from './Assign.module.css';

export interface AssignTarget {
  kind: 'mission' | 'lesson';
  targetId: string;
  /** Absent for a whole-class assignment. */
  userId?: string;
}

interface AssignResult {
  assignmentId: string;
  notifiedStudents: number;
}

export function AssignButton({
  classId,
  target,
  label,
}: {
  classId: string;
  target: AssignTarget;
  label?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: () =>
      rpc<AssignResult>('v1.teacher.assignment.create', {
        classId,
        kind: target.kind,
        targetId: target.targetId,
        targetUserId: target.userId ?? null,
        // Keyed on what is being assigned to whom rather than on a random
        // value, so a double-click or a retry after a dropped response assigns
        // once. The wrapper replays the stored reply rather than re-applying.
        idempotencyKey: `assign-${classId}-${target.userId ?? 'class'}-${target.targetId}`,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attention(classId) });
    },
  });

  if (assign.isSuccess) {
    // Says who it reached rather than only that it worked. "Assigned" leaves a
    // teacher wondering whether the six students who have not synced this week
    // are included; a number does not.
    return (
      <p className={styles.done} role="status">
        {target.userId
          ? t('assign.doneOne')
          : t('assign.doneClass', { count: assign.data?.notifiedStudents ?? 0 })}
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        disabled={assign.isPending}
        onClick={() => assign.mutate()}
      >
        {assign.isPending ? t('assign.sending') : (label ?? t('assign.action'))}
      </button>

      {assign.isError ? (
        <p className={styles.error} role="alert">
          {t('assign.failed')}
        </p>
      ) : null}

      {/* Said once, next to the button, rather than in a help page nobody
          opens: an assignment reaches a device when it next syncs, and in a
          school with one hour of connectivity a day that is not immediately. */}
      <p className={styles.caveat}>{t('assign.deliveryNote')}</p>
    </div>
  );
}
