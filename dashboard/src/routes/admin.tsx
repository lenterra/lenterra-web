/**
 * Administration: inviting staff, granting roles, and running retention.
 *
 * All three RPCs existed with no caller. In practice that meant a new teacher
 * was created by somebody with an SSH key writing an UPDATE against
 * `lenterra_account_profile`, which leaves no record of who did it or why, and
 * retention — deleting the accounts of students who asked to be deleted — ran
 * only if a person remembered to invoke it.
 *
 * Inviting is first on the page because it is the only one anybody does weekly.
 * Purge is last, because it is the only one that destroys anything.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { rpc } from '../data/nakama';
import { isForbidden } from '../data/queries';
import { ErrorPanel, Loading } from '../ui/State';
import { useRole } from '../ui/Shell';
import styles from './admin.module.css';

interface Invite {
  id: string;
  /** Null once spent, revoked, or expired: there is nothing left to copy. */
  code: string | null;
  role: string;
  transfersFrom: string | null;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'redeemed' | 'revoked' | 'expired';
  redeemedByName: string | null;
}

const INVITES_KEY = ['admin', 'staff-invites'] as const;

export default function AdminRoute() {
  const { t } = useTranslation();
  const role = useRole();

  const invites = useQuery({
    queryKey: INVITES_KEY,
    queryFn: () => rpc<{ invites: Invite[] }>('v1.admin.staff.invite.list', {}),
  });

  if (isForbidden(invites.error)) return <ErrorPanel message={t('error.forbidden')} />;
  if (invites.isLoading && !invites.data) return <Loading />;

  return (
    <div className={styles.page}>
      <h1>{t('admin.title')}</h1>

      <IssueInvite canGrantStaff={role === 'staff'} />

      <section className={styles.section}>
        <h2>{t('admin.invitesTitle')}</h2>
        <InviteList invites={invites.data?.invites ?? []} />
      </section>

      {/* Platform staff only. Granting a role directly bypasses the invite
          chain and its audit trail, so it exists for correcting a mistake
          rather than for onboarding anybody. */}
      {role === 'staff' ? <GrantRole /> : null}
      {role === 'staff' ? <Retention /> : null}
    </div>
  );
}

/**
 * Issue an invite.
 *
 * The transfer field is the one that needs explaining rather than the role
 * dropdown. A teacher who has lost access to their account would otherwise lose
 * every class with it, and this is how those classes follow them to a new one.
 * It is destructive to the old account's standing, so it says so.
 */
function IssueInvite({ canGrantStaff }: { canGrantStaff: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [role, setRole] = useState('teacher');
  const [transfersFrom, setTransfersFrom] = useState('');

  const issue = useMutation({
    mutationFn: () =>
      rpc<{ inviteId: string; code: string; expiresAt: string }>('v1.admin.staff.invite', {
        role,
        transfersFrom: transfersFrom.trim() || null,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setTransfersFrom('');
      void queryClient.invalidateQueries({ queryKey: INVITES_KEY });
    },
  });

  return (
    <section className={styles.section}>
      <h2>{t('admin.issueTitle')}</h2>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          issue.mutate();
        }}
      >
        <label className={styles.field}>
          {t('admin.role')}
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="teacher">{t('admin.roleTeacher')}</option>
            <option value="school_admin">{t('admin.roleSchoolAdmin')}</option>
            {canGrantStaff ? <option value="staff">{t('admin.roleStaff')}</option> : null}
          </select>
        </label>

        <label className={styles.field}>
          {t('admin.transfersFrom')}
          <input
            value={transfersFrom}
            onChange={(event) => setTransfersFrom(event.target.value)}
            placeholder={t('admin.transfersFromPlaceholder')}
            autoComplete="off"
          />
          <span className={styles.help}>{t('admin.transfersFromHelp')}</span>
        </label>

        <button type="submit" className={styles.submit} disabled={issue.isPending}>
          {issue.isPending ? t('admin.issuing') : t('admin.issue')}
        </button>
      </form>

      {issue.isSuccess ? (
        <div className={styles.issued} role="status">
          <span className={styles.issuedLabel}>{t('admin.issuedCode')}</span>
          {/* Large and selectable. It gets read down a phone line or copied
              into a message, and it cannot be recovered once spent. */}
          <code className={styles.code}>{issue.data.code}</code>
          <span className={styles.help}>{t('admin.issuedHelp')}</span>
        </div>
      ) : null}

      {issue.isError ? <ErrorPanel /> : null}
    </section>
  );
}

function InviteList({ invites }: { invites: Invite[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const revoke = useMutation({
    mutationFn: (inviteId: string) =>
      rpc<{ revoked: boolean }>('v1.admin.staff.invite.revoke', {
        inviteId,
        idempotencyKey: `revoke-${inviteId}`,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
  });

  if (invites.length === 0) return <p className={styles.muted}>{t('admin.noInvites')}</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('admin.role')}</th>
            <th>{t('admin.code')}</th>
            <th>{t('admin.status')}</th>
            <th>{t('admin.expires')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id}>
              <td>{t(`admin.role${roleSuffix(invite.role)}`)}</td>
              <td>{invite.code ? <code>{invite.code}</code> : <span aria-hidden>—</span>}</td>
              <td>
                {t(`admin.status${statusSuffix(invite.status)}`)}
                {invite.redeemedByName ? ` · ${invite.redeemedByName}` : ''}
              </td>
              <td>{new Date(invite.expiresAt).toLocaleDateString()}</td>
              <td>
                {invite.status === 'open' ? (
                  <button
                    type="button"
                    className={styles.revoke}
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(invite.id)}
                  >
                    {t('admin.revoke')}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const roleSuffix = (role: string) =>
  role === 'school_admin' ? 'SchoolAdmin' : role === 'staff' ? 'Staff' : 'Teacher';

const statusSuffix = (status: string) =>
  status === 'redeemed'
    ? 'Redeemed'
    : status === 'revoked'
      ? 'Revoked'
      : status === 'expired'
        ? 'Expired'
        : 'Open';

/**
 * Grant a role to an existing account.
 *
 * Deliberately plainer than the invite form and placed below it. This bypasses
 * the invite chain, so it is for correcting a mistake — a teacher granted the
 * wrong role, an account that needs demoting — and not the way anybody is
 * onboarded.
 */
function GrantRole() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('teacher');

  const grant = useMutation({
    mutationFn: () =>
      rpc<{ userId: string; role: string }>('v1.admin.role.grant', {
        userId: userId.trim(),
        role,
        idempotencyKey: `role-${userId.trim()}-${role}`,
      }),
  });

  return (
    <section className={styles.section}>
      <h2>{t('admin.grantTitle')}</h2>
      <p className={styles.help}>{t('admin.grantHelp')}</p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (userId.trim()) grant.mutate();
        }}
      >
        <label className={styles.field}>
          {t('admin.userId')}
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          {t('admin.role')}
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="student">{t('admin.roleStudent')}</option>
            <option value="teacher">{t('admin.roleTeacher')}</option>
            <option value="school_admin">{t('admin.roleSchoolAdmin')}</option>
            <option value="staff">{t('admin.roleStaff')}</option>
          </select>
        </label>

        <button type="submit" className={styles.submit} disabled={grant.isPending}>
          {t('admin.grant')}
        </button>
      </form>

      {grant.isSuccess ? (
        <p className={styles.ok} role="status">
          {t('admin.granted', { role: t(`admin.role${roleSuffix(grant.data.role)}`) })}
        </p>
      ) : null}
      {grant.isError ? <ErrorPanel /> : null}
    </section>
  );
}

/**
 * Retention.
 *
 * The purge is what actually deletes the accounts of students who asked to be
 * deleted and whose thirty days have passed. Until this button existed it ran
 * only when somebody remembered to call the RPC by hand — which means the
 * product's deletion promise was being kept by memory.
 *
 * It reports counts rather than saying "done", because the number of accounts
 * deleted is the one figure worth checking against the number of requests.
 */
function Retention() {
  const { t } = useTranslation();

  const purge = useMutation({
    mutationFn: () =>
      rpc<{
        authJti: number;
        idempotency: number;
        rateLimits: number;
        accountsDeleted: number;
      }>('v1.admin.purge', {}),
  });

  return (
    <section className={styles.section}>
      <h2>{t('admin.retentionTitle')}</h2>
      <p className={styles.help}>{t('admin.retentionHelp')}</p>

      <button
        type="button"
        className={styles.submit}
        disabled={purge.isPending}
        onClick={() => purge.mutate()}
      >
        {purge.isPending ? t('admin.purging') : t('admin.purge')}
      </button>

      {purge.isSuccess ? (
        <p className={styles.ok} role="status">
          {t('admin.purged', {
            accounts: purge.data.accountsDeleted,
            rows: purge.data.authJti + purge.data.idempotency + purge.data.rateLimits,
          })}
        </p>
      ) : null}
      {purge.isError ? <ErrorPanel /> : null}
    </section>
  );
}
