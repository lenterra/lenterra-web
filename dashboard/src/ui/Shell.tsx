/**
 * The frame every route renders inside.
 *
 * Also the auth gate. Signed-out users are redirected here rather than shown
 * an empty class list, so "signed out" means one thing across the dashboard.
 * The gate is a convenience, not a security boundary — the server refuses
 * regardless, and a UI check that were load-bearing would be one refactor from
 * being the only check.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { loadProfile, isTeacherRole, signOut, type TeacherProfile } from '../data/auth';
import { loadSession } from '../data/nakama';
import { Loading, ErrorPanel } from './State';
import styles from './Shell.module.css';

/**
 * The signed-in account, as the server described it.
 *
 * Read by routes that render differently for an administrator. It decides what
 * appears, never what is permitted — every one of those RPCs checks the role
 * again on the server, and this context existing must not become the reason
 * somebody stops doing that.
 */
const ProfileContext = createContext<TeacherProfile | null>(null);

export function useProfile(): TeacherProfile | null {
  return useContext(ProfileContext);
}

export function useRole(): string {
  return useContext(ProfileContext)?.role ?? 'teacher';
}

/** Whether to show the surfaces that act on other people's accounts. */
export function isAdminRole(role: string): boolean {
  return role === 'school_admin' || role === 'staff';
}

export function Shell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-teacher' | 'signed-out'>(
    'loading',
  );

  useEffect(() => {
    if (!loadSession()) {
      setStatus('signed-out');
      return;
    }
    loadProfile()
      .then((loaded) => {
        setProfile(loaded);
        // The server is the authority; this only decides what to render.
        setStatus(isTeacherRole(loaded.role) ? 'ready' : 'not-teacher');
      })
      .catch(() => setStatus('signed-out'));
  }, []);

  useEffect(() => {
    if (status === 'signed-out') navigate('/signin', { replace: true });
  }, [status, navigate]);

  if (status === 'loading') return <Loading />;
  if (status === 'not-teacher') return <ErrorPanel message={t('auth.notATeacher')} />;

  return (
    <ProfileContext.Provider value={profile}>
      <div className={styles.shell}>
        <header className={styles.header} data-print="hide">
          <Link to="/" className={styles.brand}>
            Lenterra
          </Link>
          <nav className={styles.nav}>
            <Link to="/">{t('nav.classes')}</Link>
            {/*
              Shown to the roles that can use them, hidden from the rest — as a
              courtesy, not as a control. Every RPC behind these pages checks
              the role again, and a teacher who typed the URL would get a
              refusal from the server rather than a queue of reports.
            */}
            {profile && isAdminRole(profile.role) ? (
              <>
                <Link to="/moderation">{t('nav.moderation')}</Link>
                <Link to="/admin">{t('nav.admin')}</Link>
              </>
            ) : null}
          </nav>
          <div className={styles.right}>
            {profile ? <span className={styles.who}>{profile.displayName}</span> : null}
            <button
              type="button"
              className={styles.signOut}
              onClick={() => {
                signOut();
                navigate('/signin', { replace: true });
              }}
            >
              {t('common.signOut')}
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </ProfileContext.Provider>
  );
}
