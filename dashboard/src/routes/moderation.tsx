/**
 * The moderation queue.
 *
 * A child could already report another child from the app — `moderation.report`
 * has been wired since the app was written — and the report landed in a queue
 * with no way to open it. That is worse than not having the button, because the
 * child believes they have been heard.
 *
 * Two things shape this page.
 *
 * **There is no free text anywhere in a report.** The reason is an enum,
 * deliberately: a free-text box in a product used by children is a channel for
 * exactly the content reporting exists to stop, and it would be the only
 * unmoderated text path in the system. So a moderator reads a category and a
 * time, and nothing a reporter typed — because a reporter cannot type.
 *
 * **Nobody is named.** The queue shows neither who reported nor who was
 * reported. A moderator deciding whether a category of report is real does not
 * need the children's names to do it, and a list of reported minors on a screen
 * is a list that can be read over a shoulder.
 *
 * The overdue count is the number that matters. The product commits to looking
 * at reports within 72 hours, and a commitment nobody is shown missing is a
 * commitment in a document.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { rpc } from '../data/nakama';
import { isForbidden } from '../data/queries';
import { Empty, ErrorPanel, Loading } from '../ui/State';
import styles from './moderation.module.css';

interface QueueItem {
  id: string;
  reason: string;
  createdAt: string;
}

interface Queue {
  items: QueueItem[];
  overdue: number;
}

const QUEUE_KEY = ['moderation', 'queue'] as const;

export default function ModerationRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => rpc<Queue>('v1.moderation.queue', {}),
    // A minute. Faster would be watching a queue that fills slowly; slower
    // would mean two moderators resolving the same report.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const resolve = useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: 'actioned' | 'dismissed' }) =>
      rpc<{ resolved: boolean }>('v1.moderation.resolve', { reportId, action }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
  });

  if (isForbidden(queue.error)) return <ErrorPanel message={t('error.forbidden')} />;
  if (queue.isLoading && !queue.data) return <Loading />;
  if (!queue.data) return <ErrorPanel onRetry={() => void queue.refetch()} />;

  const { items, overdue } = queue.data;

  return (
    <div className={styles.page}>
      <h1>{t('moderation.title')}</h1>

      {overdue > 0 ? (
        <p className={styles.overdue} role="status">
          {t('moderation.overdue', { count: overdue })}
        </p>
      ) : null}

      {items.length === 0 ? (
        // A good answer, and it should read like one rather than as an empty
        // state apologising for itself.
        <Empty title={t('moderation.emptyTitle')} body={t('moderation.emptyBody')} />
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.what}>
                <span className={styles.reason}>{t(`moderation.reason.${item.reason}`)}</span>
                <span className={styles.when}>
                  {t('moderation.reportedAt', {
                    date: new Date(item.createdAt).toLocaleString(),
                  })}
                </span>
              </div>

              <div className={styles.actions}>
                {/*
                  Two outcomes, and both close the report. "Actioned" records
                  that something was done about it elsewhere — the product has
                  no automatic sanction, and inventing one that a moderator
                  could apply with a click to a thirteen-year-old is not a
                  decision a dashboard should make on its own.
                */}
                <button
                  type="button"
                  className={styles.action}
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ reportId: item.id, action: 'actioned' })}
                >
                  {t('moderation.actioned')}
                </button>
                <button
                  type="button"
                  className={styles.dismiss}
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ reportId: item.id, action: 'dismissed' })}
                >
                  {t('moderation.dismissed')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resolve.isError ? <ErrorPanel /> : null}
    </div>
  );
}
