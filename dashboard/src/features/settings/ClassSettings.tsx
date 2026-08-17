/**
 * The two switches a teacher owns, and one they mostly should not touch.
 *
 * Both RPCs behind this have existed with no caller: a class leaderboard could
 * be turned off only by editing the database, and a school that wanted to stop
 * participating could not say so through the product at all.
 *
 * They are together because they are the same kind of control — a decision
 * about the class rather than about a student — and apart from everything else
 * on the page because nothing here is part of reading a class. It sits at the
 * bottom, closed, and a teacher who never opens it is not missing anything.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { rpc } from '../../data/nakama';
import { queryKeys } from '../../data/queries';
import { ErrorPanel } from '../../ui/State';
import styles from './ClassSettings.module.css';

interface ClassRow {
  id: string;
  leaderboardEnabled: boolean;
}

export function ClassSettings({ classId, role }: { classId: string; role: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Read from the class list rather than the summary, because that is where the
  // flag lives on the server. One source, so a toggle cannot show a state the
  // rest of the dashboard disagrees with.
  const classes = useQuery({
    queryKey: queryKeys.classes,
    queryFn: () => rpc<{ classes: ClassRow[] }>('v1.teacher.class.list', {}),
  });
  const current = classes.data?.classes.find((row) => row.id === classId);

  const setLeaderboard = useMutation({
    mutationFn: (enabled: boolean) =>
      rpc<{ enabled: boolean }>('v1.teacher.leaderboard.set', { classId, enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.classes }),
  });

  return (
    <details className={styles.panel} data-print="hide">
      <summary className={styles.summary}>{t('settings.title')}</summary>

      <div className={styles.body}>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={current?.leaderboardEnabled ?? false}
            disabled={!current || setLeaderboard.isPending}
            onChange={(event) => setLeaderboard.mutate(event.target.checked)}
          />
          <span>
            <span className={styles.label}>{t('settings.leaderboard')}</span>
            {/* The reason a teacher would turn it off, said plainly. A ranking
                is motivating for the top of a class and corrosive for the
                bottom of one, and the teacher is the only person who can judge
                which their class is. */}
            <span className={styles.help}>{t('settings.leaderboardHelp')}</span>
          </span>
        </label>

        {setLeaderboard.isError ? <ErrorPanel /> : null}

        {role === 'school_admin' || role === 'staff' ? <WithdrawConsent /> : null}
      </div>
    </details>
  );
}

/**
 * Withdrawing the school's consent.
 *
 * Only an administrator sees it, and it asks for the school's name to be typed
 * before it will fire. That is not ceremony: it stops collection for every
 * class in the school, and a mis-click on a settings panel should not be able
 * to end a pilot for four hundred students.
 *
 * It is offered at all because a consent record that cannot be withdrawn is not
 * really consent. A school that changes its mind must be able to say so here
 * rather than by sending an email to somebody who may not read it.
 */
function WithdrawConsent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState('');
  const [open, setOpen] = useState(false);

  const withdraw = useMutation({
    mutationFn: () => rpc<{ withdrawn: boolean }>('v1.teacher.consent.withdraw', {}),
    onSuccess: () => {
      setOpen(false);
      setConfirmation('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.consent });
      void queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });

  const expected = t('settings.withdrawWord');

  if (withdraw.isSuccess) {
    return (
      <p className={styles.withdrawn} role="status">
        {t('settings.withdrawDone')}
      </p>
    );
  }

  return (
    <div className={styles.danger}>
      <span className={styles.label}>{t('settings.withdrawTitle')}</span>
      <span className={styles.help}>{t('settings.withdrawHelp')}</span>

      {open ? (
        <form
          className={styles.confirm}
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmation.trim().toUpperCase() === expected.toUpperCase()) withdraw.mutate();
          }}
        >
          <label className={styles.field}>
            {t('settings.withdrawConfirmLabel', { word: expected })}
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button
            type="submit"
            className={styles.dangerButton}
            disabled={
              withdraw.isPending || confirmation.trim().toUpperCase() !== expected.toUpperCase()
            }
          >
            {t('settings.withdrawConfirm')}
          </button>
          <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </button>
        </form>
      ) : (
        <button type="button" className={styles.dangerLink} onClick={() => setOpen(true)}>
          {t('settings.withdrawTitle')}
        </button>
      )}

      {withdraw.isError ? <ErrorPanel /> : null}
    </div>
  );
}
