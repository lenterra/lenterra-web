/**
 * The class heatmap (TRD-TCH-007).
 *
 * A semantic HTML table, not a canvas. Four things follow from that choice and
 * none of them work otherwise:
 *
 *  - **It prints.** A teacher with an unreliable connection and a staff meeting
 *    will print this, and a canvas prints as a grey rectangle. The print
 *    stylesheet drops colour to patterns and keeps the letters.
 *  - **A screen reader can read it.** Each cell announces student, skill and
 *    band, because the colour is not the information.
 *  - **Colour is never the only channel.** Every cell carries a letter, so it
 *    survives greyscale printing and a colour-blind reader alike.
 *  - **It is keyboard navigable**, because it is a table of buttons rather than
 *    a drawing.
 *
 * 680 cells for a 40-student class, unvirtualised on purpose: that is well
 * within a browser's comfort, and virtualisation would break printing to save
 * nothing.
 */

import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ClassSummary, MasteryBand } from '../../data/queries';
import styles from './Heatmap.module.css';

/**
 * One letter per band.
 *
 * The initial of the Indonesian name, so the printed grid reads without a
 * legend for the person most likely to be holding it.
 */
const BAND_LETTER: Record<MasteryBand, string> = {
  not_started: '·',
  emerging: 'B', // Baru berkembang
  developing: 'S', // Sedang berkembang
  proficient: 'C', // Cakap
  mastered: 'M', // Mahir
};

export interface HeatmapProps {
  summary: ClassSummary;
  onSelectStudent: (userId: string) => void;
}

export function Heatmap({ summary, onSelectStudent }: HeatmapProps) {
  const { t } = useTranslation();

  // Column order comes from the first student who has any nodes, so the grid
  // is stable across polls even as individual students gain evidence.
  const nodes = useMemo(() => {
    const seen: string[] = [];
    for (const student of summary.heatmap) {
      for (const node of student.nodes) if (!seen.includes(node.skillNodeId)) seen.push(node.skillNodeId);
    }
    return seen.sort();
  }, [summary.heatmap]);

  if (summary.heatmap.length === 0) {
    return <p className={styles.empty}>{t('heatmap.noStudents')}</p>;
  }

  if (nodes.length === 0) {
    return <p className={styles.empty}>{t('heatmap.noEvidence')}</p>;
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {t('heatmap.caption', { students: summary.heatmap.length, skills: nodes.length })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              {t('heatmap.student')}
            </th>
            {nodes.map((node) => (
              <th key={node} scope="col" className={styles.nodeHead}>
                {/* Rotated visually, upright to a screen reader and in print. */}
                <span className={styles.nodeLabel}>{t(`skill.${node}`)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.heatmap.map((student) => {
            const byNode = new Map(student.nodes.map((node) => [node.skillNodeId, node]));
            return (
              <tr key={student.userId}>
                <th scope="row" className={styles.studentHead}>
                  <button
                    type="button"
                    className={styles.studentButton}
                    onClick={() => onSelectStudent(student.userId)}
                  >
                    {student.displayName}
                  </button>
                </th>
                {nodes.map((node) => (
                  <Cell
                    key={node}
                    band={byNode.get(node)?.band ?? 'not_started'}
                    evidenceCount={byNode.get(node)?.evidenceCount ?? 0}
                    label={t('heatmap.cell', {
                      student: student.displayName,
                      skill: t(`skill.${node}`),
                      band: t(`band.${byNode.get(node)?.band ?? 'not_started'}`),
                      count: byNode.get(node)?.evidenceCount ?? 0,
                    })}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Memoised because polling re-renders the whole grid every minute and almost
 * no cell has changed. 680 unmemoised cells re-rendering on a school laptop is
 * a visible stutter.
 */
const Cell = memo(function Cell({
  band,
  evidenceCount,
  label,
}: {
  band: MasteryBand;
  evidenceCount: number;
  label: string;
}) {
  return (
    <td className={`${styles.cell} ${styles[band]}`} title={label}>
      <span className={styles.srOnly}>{label}</span>
      <span aria-hidden="true" className={styles.letter}>
        {BAND_LETTER[band]}
      </span>
      {/*
        A single piece of evidence is marked, because one lucky mission and a
        fortnight of consistent work should not look identical on a grid a
        teacher is about to make decisions from.
      */}
      {evidenceCount === 1 ? (
        <span aria-hidden="true" className={styles.thin}>
          ·
        </span>
      ) : null}
    </td>
  );
});
