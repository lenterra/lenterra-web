/**
 * The consent gate.
 *
 * The pilot runs through schools, and a student joining a class is the moment a
 * minor's data starts being collected. So the attestation comes before the
 * class exists, not as a banner afterwards — a banner only means somebody could
 * have read one, while the students are already enrolled.
 *
 * What is attested is the **school's own process**, described in the teacher's
 * words. Not a per-parent record: R1 has no mechanism to collect one, and
 * calling this parental consent would be claiming something the system cannot
 * support. What it can support is a dated, named record of how a school says it
 * obtained consent, which is the thing a school will actually be asked to
 * produce later.
 *
 * The free-text requirement is deliberate. A checkbox records that a box was
 * ticked; the question afterwards is always *how*.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rpc } from '../../data/nakama';
import { queryKeys } from '../../data/queries';
import { ErrorPanel } from '../../ui/State';
import styles from './Consent.module.css';

export interface ConsentStatus {
  recorded: boolean;
  confirmedAt: string | null;
  processNote: string | null;
}

/** Shortest note the server accepts, mirrored so the button explains itself. */
const MIN_NOTE = 20;

export function useConsent() {
  return useQuery({
    queryKey: queryKeys.consent,
    queryFn: () => rpc<ConsentStatus>('v1.teacher.consent.status', {}),
    staleTime: 5 * 60_000,
  });
}

export function ConsentGate({ status }: { status: ConsentStatus }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const record = useMutation({
    mutationFn: () =>
      rpc<{ consentId: string }>('v1.teacher.consent.record', {
        processNote: note.trim(),
        confirmed: true,
        idempotencyKey: `consent-${note.trim().slice(0, 32)}`,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.consent }),
  });

  if (status.recorded) {
    return (
      <section className={styles.recorded}>
        <h2 className={styles.recordedTitle}>{t('consent.recordedTitle')}</h2>
        <p className={styles.recordedMeta}>
          {t('consent.recordedOn', {
            date: status.confirmedAt
              ? new Date(status.confirmedAt).toLocaleDateString()
              : t('consent.unknownDate'),
          })}
        </p>
        {/* Shown back, not hidden once accepted. A record nobody can read is a
            record nobody can check. */}
        {status.processNote ? <p className={styles.note}>{status.processNote}</p> : null}
      </section>
    );
  }

  return (
    <section className={styles.gate}>
      <h2 className={styles.gateTitle}>{t('consent.title')}</h2>
      <p className={styles.gateBody}>{t('consent.body')}</p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim().length >= MIN_NOTE) record.mutate();
        }}
      >
        <label className={styles.field}>
          {t('consent.processLabel')}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t('consent.processPlaceholder')}
            required
          />
        </label>

        <p className={styles.hint}>{t('consent.processHint')}</p>

        <button
          type="submit"
          className={styles.submit}
          disabled={record.isPending || note.trim().length < MIN_NOTE}
        >
          {t('consent.confirm')}
        </button>

        {record.isError ? <ErrorPanel /> : null}
      </form>
    </section>
  );
}
