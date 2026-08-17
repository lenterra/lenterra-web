/**
 * The class roster.
 *
 * Two things here are safety rather than convenience.
 *
 * Removing a student is confirmed and never deletes their work:
 * it ends their membership of this class. A teacher tidying a roster must not
 * be able to destroy a term of a child's learning history with one tap.
 *
 * Reclaim approvals exist because a class-code account has no email to recover
 * through, so the teacher is the recovery mechanism. Approving
 * one transfers an account, which is exactly why it is a deliberate,
 * audited action rather than a quiet one.
 */

import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rpc } from '../../data/nakama';
import { queryKeys, type Roster as RosterData } from '../../data/queries';
import styles from './Roster.module.css';

export function Roster({ classId, roster }: { classId: string; roster: RosterData }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.roster(classId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.classSummary(classId) });
  };

  const remove = useMutation({
    mutationFn: (userId: string) =>
      rpc('v1.teacher.class.remove', { classId, userId, idempotencyKey: `remove-${userId}` }),
    onSuccess: invalidate,
  });

  const resolveReclaim = useMutation({
    mutationFn: (input: { requestId: string; approve: boolean }) =>
      rpc('v1.teacher.reclaim.approve', {
        requestId: input.requestId,
        approve: input.approve,
        idempotencyKey: `reclaim-${input.requestId}-${input.approve}`,
      }),
    onSuccess: invalidate,
  });

  return (
    <>
      {roster.pendingReclaims.length > 0 ? (
        <section className={styles.reclaims}>
          <h3>{t('roster.reclaims')}</h3>
          <ul className={styles.reclaimList}>
            {roster.pendingReclaims.map((request) => (
              <li key={request.requestId} className={styles.reclaimRow}>
                {/* Masked, so approving is a recognition task rather than a
                    roster listing anyone can read off the screen. */}
                <span>{request.maskedName}</span>
                <button
                  type="button"
                  onClick={() =>
                    resolveReclaim.mutate({ requestId: request.requestId, approve: true })
                  }
                >
                  {t('roster.approve')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    resolveReclaim.mutate({ requestId: request.requestId, approve: false })
                  }
                >
                  {t('roster.reject')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('roster.name')}</th>
            <th scope="col">{t('roster.joined')}</th>
            <th scope="col">{t('roster.lastActive')}</th>
            <th scope="col">{t('roster.attempts')}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {roster.students.map((student) => (
            <tr key={student.userId}>
              <td>{student.displayName}</td>
              <td>{new Date(student.joinedAt).toLocaleDateString()}</td>
              <td>
                {student.lastActiveAt
                  ? new Date(student.lastActiveAt).toLocaleDateString()
                  : t('student.never')}
              </td>
              <td>{student.attempts}</td>
              <td>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => {
                    // Confirmed, because it is irreversible from here even
                    // though it destroys nothing (TRD-TCH-010).
                    if (window.confirm(t('roster.removeConfirm', { name: student.displayName }))) {
                      remove.mutate(student.userId);
                    }
                  }}
                >
                  {t('roster.remove')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
