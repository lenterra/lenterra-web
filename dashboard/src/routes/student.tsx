/**
 * One student.
 *
 * A teaching brief, not a dossier (PRD-TCH-009, PRD-TCH-016). It opens with a
 * plain sentence about what this student is good at and what to do next,
 * because that is what a teacher with four minutes before a lesson actually
 * needs — and the evidence sits underneath for when they want to check it.
 *
 * The evidence is complete rather than sampled (PRD-TCH-008). Every claim on
 * this page drills down to the attempts behind it; a summary that cannot be
 * checked is asking to be trusted rather than read, and a teacher who cannot
 * check it correctly stops believing the whole dashboard.
 *
 * There is no session-by-session timeline of when a child was online. Play
 * times at individual granularity serve no teaching purpose and are a
 * safeguarding hazard (TRD-OBS-002).
 */

import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { isForbidden, useStudentDetail } from '../data/queries';
import { ErrorPanel, Loading } from '../ui/State';
import styles from './student.module.css';

export default function StudentRoute() {
  const { t } = useTranslation();
  const { classId = null, userId = null } = useParams();
  const detail = useStudentDetail(classId, userId);

  if (isForbidden(detail.error)) return <ErrorPanel message={t('error.forbidden')} />;
  if (detail.isLoading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorPanel onRetry={() => void detail.refetch()} />;

  const data = detail.data;

  return (
    <div className={styles.page}>
      <Link to={`/class/${classId}`} className={styles.back} data-print="hide">
        ← {t('common.back')}
      </Link>

      <header className={styles.head}>
        <h1>{data.student.displayName}</h1>
        <p className={styles.meta}>
          {t('student.lastActive')}:{' '}
          {data.student.lastActiveAt
            ? new Date(data.student.lastActiveAt).toLocaleDateString()
            : t('student.never')}
        </p>
      </header>

      {/*
        The brief. Keys and parameters from the server rather than a rendered
        sentence, so the wording is content that can be translated and reviewed
        rather than a string baked into a bundle.
      */}
      <section className={styles.brief}>
        <p className={styles.strength}>{t(data.summaryText.strengthKey, data.summaryText.params)}</p>
        <p className={styles.next}>{t(data.summaryText.nextActionKey, data.summaryText.params)}</p>
      </section>

      <section className={styles.section}>
        <h2>{t('classView.heatmapTitle')}</h2>
        <table className={styles.mastery}>
          <thead>
            <tr>
              <th scope="col">{t('heatmap.student')}</th>
              <th scope="col">{t('band.proficient')}</th>
              <th scope="col">{t('student.evidence')}</th>
            </tr>
          </thead>
          <tbody>
            {data.mastery.map((node) => (
              <tr key={node.skillNodeId}>
                <th scope="row">{t(`skill.${node.skillNodeId}`)}</th>
                <td>
                  {t(`band.${node.band}`)}
                  {/* The raw value is shown to teachers and never to students
                      (PRD-ADPT-005): a teacher needs to judge whether 0.68 and
                      0.71 differ, and evidenceCount says whether either means
                      anything yet. */}
                  <span className={styles.raw}>{node.mastery.toFixed(2)}</span>
                </td>
                <td>
                  {node.evidenceCount}
                  {node.distinctSources < 2 ? (
                    <span className={styles.thin}> ({node.distinctSources})</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>{t('student.recent')}</h2>
        <ul className={styles.attempts}>
          {data.recentAttempts.map((attempt) => (
            <li key={attempt.attemptId} className={styles.attempt}>
              <span>{attempt.missionId}</span>
              <span className={attempt.outcome === 'success' ? styles.pass : styles.fail}>
                {attempt.outcome}
              </span>
              <span className={styles.when}>{new Date(attempt.at).toLocaleDateString()}</span>
              {attempt.playedOffline ? (
                <span className={styles.tag}>{t('student.offline')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>{t('student.evidence')}</h2>
        {data.evidence.map((entry) => (
          <details key={entry.skillNodeId} className={styles.evidence}>
            <summary>{t(`skill.${entry.skillNodeId}`)}</summary>
            {entry.events.length === 0 ? (
              <p className={styles.muted}>{t('student.noEvidence')}</p>
            ) : (
              <ul className={styles.events}>
                {entry.events.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    {new Date(event.at).toLocaleDateString()} · {event.missionId ?? '—'} ·{' '}
                    {event.outcome}
                    {event.hintUsed ? ` · ${t('student.hintUsed')}` : ''} ·{' '}
                    {event.masteryBefore.toFixed(2)} → {event.masteryAfter.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}
