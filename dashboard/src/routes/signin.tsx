/**
 * Teacher sign-in.
 *
 * Email code, same chain as the app: the wallet is invisible plumbing and a
 * teacher never learns it exists (ADR-002). What they see is an address and a
 * six-digit code.
 *
 * The thirdweb web SDK owns the wallet connection itself; this screen owns the
 * two fields and the honest failure messages. A sign-in that fails silently on
 * a school connection is the single most likely reason a teacher gives up.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { completeSignIn } from '../data/auth';
import { ErrorPanel } from '../ui/State';
import styles from './signin.module.css';

type Step = 'email' | 'code' | 'working';

export default function SignInRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    setStep('working');
    try {
      const { sendVerificationCode } = await import('../data/wallet');
      await sendVerificationCode(email);
      setStep('code');
    } catch {
      setError(t('auth.failed'));
      setStep('email');
    }
  };

  const verify = async () => {
    setError(null);
    setStep('working');
    try {
      const { connectWithCode } = await import('../data/wallet');
      const signer = await connectWithCode(email, code);
      await completeSignIn(signer);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.failed'));
      setStep('code');
    }
  };

  return (
    <div className={styles.page}>
      <h1>{t('auth.title')}</h1>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void (step === 'email' ? sendCode() : verify());
        }}
      >
        <label className={styles.field}>
          {t('auth.emailLabel')}
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={step !== 'email'}
            required
          />
        </label>

        {step !== 'email' ? (
          <label className={styles.field}>
            {t('auth.codeLabel')}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={8}
              required
            />
          </label>
        ) : null}

        <button type="submit" className={styles.submit} disabled={step === 'working'}>
          {step === 'working'
            ? t('auth.sending')
            : step === 'email'
              ? t('auth.sendCode')
              : t('auth.verify')}
        </button>
      </form>

      {error ? <ErrorPanel message={error} /> : null}
    </div>
  );
}
