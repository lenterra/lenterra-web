/**
 * The attention list (PRD-TCH-007).
 *
 * At most five, and each one names the reason and a next action. The cap is
 * the point: a list of thirty "students needing attention" is a list nobody
 * acts on, and a teacher with one free period can help about five people.
 *
 * Every entry is a claim about a child, so each is a link into the evidence
 * behind it (PRD-TCH-008). A dashboard that asserts "Rina is struggling" and
 * cannot show why is asking to be believed rather than read.
 */

import { useTranslation } from 'react-i18next';

import type { AttentionList } from '../../data/queries';
import { AssignButton } from '../assign/Assign';
import styles from './Attention.module.css';

export function Attention({
  classId,
  list,
  onSelect,
}: {
  classId: string;
  list: AttentionList | undefined;
  onSelect: (userId: string) => void;
}) {
  const { t } = useTranslation();

  if (!list) return <p className={styles.muted}>{t('common.loading')}</p>;
  if (list.students.length === 0) {
    // Not an empty state to apologise for. "Nobody needs particular attention"
    // is a good answer, and it should read like one.
    return <p className={styles.muted}>{t('classView.noAttention')}</p>;
  }

  return (
    <ul className={styles.list}>
      {list.students.slice(0, 5).map((student) => (
        <li key={student.userId} className={styles.item}>
          <button type="button" className={styles.button} onClick={() => onSelect(student.userId)}>
            <span className={styles.reason}>
              {t(`attention.${student.reason}`, {
                name: student.displayName,
                // Skill ids arrive as parameters; they are translated here so
                // the sentence reads in the teacher's language rather than
                // splicing `algo.greedy` into Indonesian prose.
                skill: student.params['skillNodeId']
                  ? t(`skill.${student.params['skillNodeId']}`)
                  : '',
                ...student.params,
              })}
            </span>
            <span className={styles.action}>
              {t(`attention.${student.suggestedAction.kind}`)}
            </span>
          </button>

          {/*
            The suggested action, made doable. Where the suggestion is "talk to
            them" there is nothing to assign and no button appears — a dashboard
            that offered work in place of a conversation would be answering a
            different question than the one it asked.
          */}
          {student.suggestedAction.targetId &&
          student.suggestedAction.kind !== 'talk' ? (
            <AssignButton
              classId={classId}
              target={{
                kind: student.suggestedAction.kind === 'assign_lesson' ? 'lesson' : 'mission',
                targetId: student.suggestedAction.targetId,
                userId: student.userId,
              }}
              label={t('assign.toStudent', { name: student.displayName })}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
