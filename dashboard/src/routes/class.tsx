/**
 * One class.
 *
 * The order on this page is an argument, not a layout preference. A teacher
 * opens it with about thirty seconds of attention, so the top of the page is
 * what to *do* — the gaps worth teaching and the students who need a word —
 * and the grid that lets them check that judgement comes after it.
 *
 * Participation is present but small (PRD-TCH-006): how much a class played is
 * the easiest number to collect and the least useful one to lead with, and a
 * dashboard headlining activity teaches teachers to optimise for activity.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { isForbidden, useAttention, useClassSummary, useRoster } from '../data/queries';
import { Heatmap } from '../features/heatmap/Heatmap';
import { Attention } from '../features/attention/Attention';
import { Roster } from '../features/roster/Roster';
import { Empty, ErrorPanel, Freshness, Loading, UnsyncedNotice } from '../ui/State';
import styles from './class.module.css';

export default function ClassRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { classId = null } = useParams();
  const [liveRoster, setLiveRoster] = useState(false);

  const summary = useClassSummary(classId);
  const attention = useAttention(classId);
  const roster = useRoster(classId, liveRoster);

  if (isForbidden(summary.error)) {
    return <ErrorPanel message={t('error.forbidden')} />;
  }
  if (summary.isLoading && !summary.data) return <Loading />;
  if (!summary.data) return <ErrorPanel onRetry={() => void summary.refetch()} />;

  const data = summary.data;
  // A failed refetch keeps the data and marks it, rather than replacing what
  // the teacher was reading with an error (TRD-TCH-005).
  const stale = summary.isError;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('classView.heatmapTitle')}</h1>
        <Freshness generatedAt={data.generatedAt} stale={stale} />
        <button
          type="button"
          className={styles.print}
          data-print="hide"
          onClick={() => window.print()}
        >
          {t('common.print')}
        </button>
      </header>

      {data.unsyncedWarning ? (
        <UnsyncedNotice students={data.unsyncedWarning.studentsWithStaleData} />
      ) : null}

      {/* What to teach next, named rather than left to inspection
          (PRD-TCH-005). A grid alone asks a teacher to do the analysis. */}
      <section className={styles.section}>
        <h2>{t('classView.gapsTitle')}</h2>
        {data.gaps.length === 0 ? (
          <p className={styles.muted}>{t('classView.noGaps')}</p>
        ) : (
          <ul className={styles.gaps}>
            {data.gaps.slice(0, 3).map((gap) => (
              <li key={gap.skillNodeId} className={styles.gap}>
                <span className={styles.gapName}>{t(`skill.${gap.skillNodeId}`)}</span>
                <span className={styles.gapCount}>
                  {t('classView.gapLine', {
                    below: gap.studentsBelowProficient,
                    total: gap.totalStudents,
                  })}
                </span>
                {gap.suggestedMissionIds.length > 0 ? (
                  <span className={styles.gapSuggestion}>
                    {t('classView.suggestedMissions')}: {gap.suggestedMissionIds.join(', ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>{t('classView.attentionTitle')}</h2>
        <Attention
          list={attention.data}
          onSelect={(userId) => navigate(`/class/${classId}/student/${userId}`)}
        />
      </section>

      <section className={styles.section}>
        <h2>{t('classView.heatmapTitle')}</h2>
        <p className={styles.legend}>{t('heatmap.legend')}</p>
        <Heatmap
          summary={data}
          onSelectStudent={(userId) => navigate(`/class/${classId}/student/${userId}`)}
        />
      </section>

      <section className={styles.section} data-print="hide">
        <div className={styles.rosterHead}>
          <h2>{t('classView.rosterTitle')}</h2>
          {/* Fast polling only while a teacher is watching students join, not
              for the whole session (TRD-TCH-006). */}
          <label className={styles.liveToggle}>
            <input
              type="checkbox"
              checked={liveRoster}
              onChange={(event) => setLiveRoster(event.target.checked)}
            />
            {t('roster.waiting')}
          </label>
        </div>
        {roster.data ? (
          <Roster classId={classId ?? ''} roster={roster.data} />
        ) : (
          <Empty title={t('classView.rosterTitle')} body={t('common.loading')} />
        )}
      </section>

      <section className={styles.participation} data-print="hide">
        <Stat label={t('classView.enrolled')} value={data.participation.enrolled} />
        <Stat label={t('classView.active')} value={data.participation.activeThisPeriod} />
        <Stat label={t('classView.medianAttempts')} value={data.participation.medianAttempts} />
        <Stat label={t('classView.medianMinutes')} value={data.participation.medianMinutes} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
