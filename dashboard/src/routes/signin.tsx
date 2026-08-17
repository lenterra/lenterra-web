/**
 * Teacher sign-in.
 *
 * One field: the invite code an administrator gave them. It replaces a two-step
 * email flow, and the step it removes is the one that failed most often — a
 * teacher waiting on a code that was slow, filtered, or sent to an address they
 * do not check from school.
 *
 * The failures are told apart, because the next action differs. An invalid code
 * means look at it again; a spent one means ask for another; an unreachable
 * service means the network, not them. A sign-in that fails without saying
 * which is the single most likely reason a teacher gives up.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { SignInError, signInWithStaffCode } from '../data/auth';
import { ErrorPanel } from '../ui/State';
import styles from './signin.module.css';

/** Reasons worth their own sentence. Anything else is the generic failure. */
const DETAIL_KEYS: Record<string, string> = {
  missing_code: 'auth.codeInvalid',
  invalid_code: 'auth.codeInvalid',
  too_many_attempts: 'auth.codeTooManyTries',
  unreachable: 'auth.unreachable',
};

export default function SignInRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setWorking(true);
    try {
      await signInWithStaffCode(code);
      navigate('/', { replace: true });
    } catch (err) {
      const detail = err instanceof SignInError ? err.detail : undefined;
      setError(t(detail ? (DETAIL_KEYS[detail] ?? 'auth.failed') : 'auth.failed'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1>{t('auth.title')}</h1>
      <p className={styles.help}>{t('auth.codeHelp')}</p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className={styles.field}>
          {t('auth.staffCodeLabel')}
          <input
            name="code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            // Upper-cased as it is typed. The code is issued in capitals and
            // read off a note or a phone call; being told a correct code is
            // wrong because of its case is an avoidable dead end.
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ''))}
            maxLength={16}
            disabled={working}
            required
          />
        </label>

        <button type="submit" className={styles.submit} disabled={working || code.length === 0}>
          {working ? t('auth.sending') : t('auth.verify')}
        </button>
      </form>

      {error ? <ErrorPanel message={error} /> : null}
    </div>
  );
}
