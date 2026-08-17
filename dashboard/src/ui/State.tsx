/**
 * Loading, empty, stale and error states.
 *
 * The stale case is the one that matters most (TRD-TCH-005). When a refetch
 * fails, the dashboard keeps showing what the teacher was reading and marks it
 * with its timestamp — a full-screen error replacing a correct-a-minute-ago
 * heatmap helps nobody and loses the thing they were mid-sentence about.
 */

import { useTranslation } from 'react-i18next';

import styles from './State.module.css';

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <p className={styles.loading} role="status">
      {label ?? t('common.loading')}
    </p>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.error} role="alert">
      <p>{message ?? t('error.generic')}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}

/**
 * A non-blocking freshness line.
 *
 * Every view shows its `generatedAt` (TRD-TCH-006), because a number with no
 * timestamp beside it is read as "now" — and during a connection drop that is
 * exactly what it is not.
 */
export function Freshness({
  generatedAt,
  stale = false,
}: {
  generatedAt: string;
  stale?: boolean;
}) {
  const { t } = useTranslation();
  const when = new Date(generatedAt);

  return (
    <p className={stale ? styles.stale : styles.fresh} data-print="hide">
      {stale
        ? t('common.staleSince', { time: when.toLocaleTimeString() })
        : t('common.updatedAt', { time: when.toLocaleTimeString() })}
    </p>
  );
}

/**
 * The unsynced-data warning.
 *
 * The API tells the dashboard when the picture is incomplete, so the dashboard
 * cannot silently present it as complete. A teacher deciding who
 * needs help from data missing three students' week would be making a worse
 * decision than one made with no data at all.
 */
export function UnsyncedNotice({ students }: { students: number }) {
  const { t } = useTranslation();
  if (students <= 0) return null;

  return (
    <p className={styles.unsynced}>{t('common.unsyncedWarning', { count: students })}</p>
  );
}
