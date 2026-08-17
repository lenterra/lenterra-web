/**
 * The class list, and creating one.
 *
 * Class creation is the first thing a teacher does and the requirement is that
 * it takes under two minutes (PRD-TCH-001). So the form is two fields, and the
 * join code appears immediately afterwards large enough to read off a screen
 * and write on a whiteboard.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { rpc } from "../data/nakama";
import { queryKeys } from "../data/queries";
import { ConsentGate, useConsent } from "../features/consent/Consent";
import { Empty, ErrorPanel, Loading } from "../ui/State";
import styles from "./classes.module.css";

interface ClassRow {
  id: string;
  name: string;
  level: string;
  students: number;
  joinCode: string;
}

export default function ClassesRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");

  const classes = useQuery({
    queryKey: queryKeys.classes,
    queryFn: () => rpc<{ classes: ClassRow[] }>("v1.teacher.class.list", {}),
  });
  const consent = useConsent();

  const create = useMutation({
    mutationFn: () =>
      rpc<{ classId: string; joinCode: string }>("v1.teacher.class.create", {
        name,
        level,
        idempotencyKey: `class-${name}-${level}`,
      }),
    onSuccess: () => {
      setName("");
      setLevel("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });

  if (classes.isLoading && !classes.data) return <Loading />;
  if (classes.isError && !classes.data) {
    return <ErrorPanel onRetry={() => void classes.refetch()} />;
  }

  const rows = classes.data?.classes ?? [];

  return (
    <div className={styles.page}>
      <h1>{t("classes.title")}</h1>

      {/*
        Before the list, not after it. The server refuses to create a class
        without a consent record, so a form offered above an unanswered gate
        would just fail on submit — and a teacher would learn the rule from an
        error rather than from the screen.
      */}
      {consent.data ? <ConsentGate status={consent.data} /> : null}

      {rows.length === 0 ? (
        <Empty title={t("classes.empty")} body={t("classes.emptyBody")} />
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.card}>
              <Link to={`/class/${row.id}`} className={styles.cardLink}>
                <span className={styles.cardName}>{row.name}</span>
                <span className={styles.cardMeta}>
                  {row.level} · {t("classes.students", { count: row.students })}
                </span>
              </Link>
              {/* Large, because it gets copied onto a whiteboard from across
                  a room (PRD-ONB-002). */}
              <span className={styles.code}>{row.joinCode}</span>
            </li>
          ))}
        </ul>
      )}

      {consent.data?.recorded ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length > 0) create.mutate();
          }}
        >
          <h2>{t("classes.create")}</h2>
          <label className={styles.field}>
            {t("classes.name")}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
            />
          </label>
          <label className={styles.field}>
            {t("classes.level")}
            <input
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              maxLength={20}
            />
          </label>
          <button
            type="submit"
            className={styles.submit}
            disabled={create.isPending}
          >
            {t("classes.create")}
          </button>
          {create.isError ? <ErrorPanel /> : null}
        </form>
      ) : null}
    </div>
  );
}
