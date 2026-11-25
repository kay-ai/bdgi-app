"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  addCoachAction,
  addStudentsAction,
  assignCoachAction,
  removeMemberAction,
  saveGroupAction,
  searchStudentsAction,
  type Candidate,
  type GroupResult,
} from "@/app/[locale]/console/groups/actions";

type Msg = { kind: "ok" | "err"; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`text-[15px] ${msg.kind === "err" ? "error" : ""}`} role={msg.kind === "err" ? "alert" : "status"}>
      {msg.text}
    </p>
  );
}

function useFail() {
  const t = useTranslations("console.groups");
  return (r: GroupResult) => (r.ok ? "" : (["denied", "invalid", "full", "closed", "exists", "not_cleared", "not_active", "invalid_phone"] as const).includes(r.code as "denied") ? t(`err.${r.code}` as "err.denied") : t("err.failed"));
}

export type GroupValue = {
  name: string;
  programmeId: string;
  schoolId: string;
  term: string;
  startsOn: string;
  endsOn: string;
  meetingDay: number | null;
  meetingTime: string;
  venue: string;
  capacity: number;
  status: string;
};

const STATUSES = ["draft", "open", "running", "completed", "cancelled"] as const;

/** Create a group, or edit one (`id` set). */
export function GroupForm({
  id,
  initial,
  programmes,
  schools,
}: {
  id?: string;
  initial?: GroupValue;
  programmes: { id: string; name: string }[];
  schools: { id: string; name: string; state: string | null }[];
}) {
  const t = useTranslations("console.groups");
  const fail = useFail();
  const fid = useId();
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const v: GroupValue = initial ?? {
    name: "",
    programmeId: programmes[0]?.id ?? "",
    schoolId: "",
    term: "",
    startsOn: "",
    endsOn: "",
    meetingDay: null,
    meetingTime: "",
    venue: "",
    capacity: 30,
    status: "open",
  };
  return (
    <form
      className="card grid gap-5 !p-5 sm:!p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const day = String(fd.get("meetingDay") ?? "");
        setMsg(null);
        start(async () => {
          const r = await saveGroupAction(id ?? null, {
            name: String(fd.get("name") ?? ""),
            programmeId: String(fd.get("programmeId") ?? ""),
            schoolId: String(fd.get("schoolId") ?? ""),
            term: String(fd.get("term") ?? ""),
            startsOn: String(fd.get("startsOn") ?? ""),
            endsOn: String(fd.get("endsOn") ?? ""),
            meetingDay: day === "" ? null : Number(day),
            meetingTime: String(fd.get("meetingTime") ?? ""),
            venue: String(fd.get("venue") ?? ""),
            capacity: Number(fd.get("capacity") ?? 30),
            status: String(fd.get("status") ?? "open"),
          }).catch(() => ({ ok: false as const, code: "error" }));
          if (!r.ok) return setMsg({ kind: "err", text: fail(r) });
          if (id) {
            setMsg({ kind: "ok", text: t("saved") });
            router.refresh();
          } else router.push(`/console/groups/${r.id}`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor={`${fid}-name`}>{t("f.name")}</label>
          <input id={`${fid}-name`} name="name" className="input" required minLength={2} maxLength={80} defaultValue={v.name} placeholder={t("f.namePlaceholder")} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-school`}>{t("f.school")}</label>
          <select id={`${fid}-school`} name="schoolId" className="input" required defaultValue={v.schoolId}>
            <option value="">{t("f.choose")}</option>
            {schools.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.state ? ` (${x.state})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-prog`}>{t("f.programme")}</label>
          <select id={`${fid}-prog`} name="programmeId" className="input" required defaultValue={v.programmeId}>
            {programmes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-term`}>{t("f.term")}</label>
          <input id={`${fid}-term`} name="term" className="input" required minLength={2} maxLength={40} defaultValue={v.term} placeholder={t("f.termPlaceholder")} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-cap`}>{t("f.capacity")}</label>
          <input id={`${fid}-cap`} name="capacity" className="input" type="number" min={1} max={200} required defaultValue={v.capacity} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-start`}>{t("f.startsOn")}</label>
          <input id={`${fid}-start`} name="startsOn" className="input" type="date" required defaultValue={v.startsOn} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-end`}>{t("f.endsOn")}</label>
          <input id={`${fid}-end`} name="endsOn" className="input" type="date" required defaultValue={v.endsOn} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-day`}>{t("f.meetingDay")}</label>
          <select id={`${fid}-day`} name="meetingDay" className="input" defaultValue={v.meetingDay === null ? "" : String(v.meetingDay)}>
            <option value="">{t("f.notSet")}</option>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                {t(`day.${d}` as "day.1")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-time`}>{t("f.meetingTime")}</label>
          <input id={`${fid}-time`} name="meetingTime" className="input" type="time" defaultValue={v.meetingTime} />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor={`${fid}-venue`}>{t("f.venue")}</label>
          <input id={`${fid}-venue`} name="venue" className="input" maxLength={120} defaultValue={v.venue} placeholder={t("f.venuePlaceholder")} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-status`}>{t("f.status")}</label>
          <select id={`${fid}-status`} name="status" className="input" defaultValue={v.status}>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {t(`st.${x}`)}
              </option>
            ))}
          </select>
          <span className="text-[14px] text-muted">{t("f.statusHelp")}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending} aria-busy={pending}>
          {pending ? t("saving") : id ? t("save") : t("create")}
        </button>
        <Note msg={msg} />
      </div>
    </form>
  );
}

/** Search students and add the ticked ones to the group. */
export function AddStudents({ cohortId, free }: { cohortId: string; free: number }) {
  const t = useTranslations("console.groups");
  const fail = useFail();
  const fid = useId();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const h = setTimeout(() => {
      searchStudentsAction(cohortId, q).then((r) => live && setRows(r));
    }, 250);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [cohortId, q]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="card grid gap-4 !p-5">
      <div className="field">
        <label htmlFor={`${fid}-q`}>{t("searchStudents")}</label>
        <input id={`${fid}-q`} className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
        <span className="text-[14px] text-muted">{t("searchHelp", { free })}</span>
      </div>
      {rows === null ? (
        <p className="text-muted">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">{t("noCandidates")}</p>
      ) : (
        <ul className="grid max-h-[360px] gap-1 overflow-y-auto" role="list">
          {rows.map((r) => (
            <li key={r.id}>
              <label className="opt !min-h-11 items-start !p-3">
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {r.firstName} {r.surname}
                  </span>
                  <span className="text-[13px] text-muted">
                    {[r.school, r.classLevel, r.age ? t("age", { n: r.age }) : null, r.status === "waitlisted" ? t("waitlisted") : null, r.otherGroup ? t("inGroup", { name: r.otherGroup }) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <label className="opt items-start !p-3">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span className="grid gap-0.5">
          <span>{t("notify")}</span>
          <span className="text-[13px] text-muted">{t("notifyHelp")}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn"
          disabled={pending || picked.size === 0}
          aria-busy={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await addStudentsAction(cohortId, [...picked], notify).catch(() => ({ ok: false as const, code: "error" }));
              if (!r.ok) return setMsg({ kind: "err", text: fail(r) });
              setPicked(new Set());
              setMsg({ kind: "ok", text: t("added", { n: r.added ?? 0 }) });
              setRows(await searchStudentsAction(cohortId, q));
              router.refresh();
            })
          }
        >
          {pending ? t("saving") : t("addPicked", { n: picked.size })}
        </button>
        <Note msg={msg} />
      </div>
    </div>
  );
}

type Coach = { id: string; firstName: string; surname: string; state: string | null; groups: number; maxCohorts: number; cleared: boolean };

/** Choose an active volunteer as lead or assistant coach; uncleared ones need the safeguarding tick. */
export function AssignCoach({ cohortId, candidates, newCoachHref }: { cohortId: string; candidates: Coach[]; newCoachHref: string }) {
  const t = useTranslations("console.groups");
  const fail = useFail();
  const fid = useId();
  const router = useRouter();
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<"lead_coach" | "assistant_coach">("lead_coach");
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const chosen = candidates.find((c) => c.id === personId);
  return (
    <form
      className="card grid gap-4 !p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const r = await assignCoachAction(cohortId, { personId, role, confirmSafeguarding: confirm }).catch(() => ({ ok: false as const, code: "error" }));
          if (!r.ok) return setMsg({ kind: "err", text: fail(r) });
          setPersonId("");
          setConfirm(false);
          setMsg({ kind: "ok", text: t("coachAdded") });
          router.refresh();
        });
      }}
    >
      {candidates.length === 0 ? (
        <p className="text-muted">{t("noVolunteers")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor={`${fid}-who`}>{t("volunteer")}</label>
            <select id={`${fid}-who`} className="input" required value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">{t("f.choose")}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.surname}
                  {c.state ? ` · ${c.state}` : ""}
                  {c.groups ? ` · ${t("groupsCount", { n: c.groups })}` : ""}
                  {c.cleared ? "" : ` · ${t("notCleared")}`}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${fid}-role`}>{t("role")}</label>
            <select id={`${fid}-role`} className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="lead_coach">{t("lead_coach")}</option>
              <option value="assistant_coach">{t("assistant_coach")}</option>
            </select>
          </div>
        </div>
      )}
      {chosen && chosen.groups >= chosen.maxCohorts && <p className="text-[14px] text-muted">{t("atMax", { name: chosen.firstName, n: chosen.groups })}</p>}
      {chosen && !chosen.cleared && (
        <label className="opt items-start !p-4">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
          <span className="grid gap-1">
            <span className="font-medium">{t("confirmSafeguarding", { name: chosen.firstName })}</span>
            <span className="text-[14px] text-muted">{t("confirmSafeguardingHelp")}</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {candidates.length > 0 && (
          <button className="btn" disabled={pending || !personId} aria-busy={pending}>
            {pending ? t("saving") : t("assign")}
          </button>
        )}
        <Link href={newCoachHref} className="uline text-[15px]">
          {t("addNewCoach")}
        </Link>
        <Note msg={msg} />
      </div>
    </form>
  );
}

/** "Remove" with a short reason and one confirmation. */
export function RemoveMember({ cohortId, personId, name }: { cohortId: string; personId: string; name: string }) {
  const t = useTranslations("console.groups");
  const fail = useFail();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="uline text-[14px]" onClick={() => setOpen(true)}>
        {t("remove")}
      </button>
    );
  return (
    <div className="grid min-w-[220px] gap-2">
      <label className="text-[14px]">
        {t("removeAsk", { name })}
        <input className="input mt-1 !min-h-10 text-[14px]" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={t("removeReason")} />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn--plain !min-h-10 !px-4 !text-[14px]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await removeMemberAction(cohortId, personId, reason).catch(() => ({ ok: false as const, code: "error" }));
              if (r.ok) router.refresh();
              else setErr(fail(r));
            })
          }
        >
          {pending ? t("saving") : t("removeConfirm")}
        </button>
        <button type="button" className="uline text-[14px]" onClick={() => setOpen(false)}>
          {t("cancel")}
        </button>
      </div>
      {err && (
        <p className="error text-[14px]" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

/** Staff add a coach directly, confirming her safeguarding checks (D-021). */
export function NewCoachForm({
  states,
  groups,
  groupId,
}: {
  states: { id: string; name: string }[];
  groups: { id: string; name: string; school: string }[];
  groupId?: string;
}) {
  const t = useTranslations("console.groups");
  const fail = useFail();
  const fid = useId();
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid gap-5 !p-5 sm:!p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        start(async () => {
          const cohortId = String(fd.get("cohortId") ?? "");
          const r = await addCoachAction({
            firstName: String(fd.get("firstName") ?? ""),
            surname: String(fd.get("surname") ?? ""),
            gender: String(fd.get("gender") ?? "female"),
            email: String(fd.get("email") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            stateId: String(fd.get("stateId") ?? ""),
            occupation: String(fd.get("occupation") ?? ""),
            safeguardingChecked: fd.get("safeguardingChecked") === "on",
            cohortId,
            role: String(fd.get("role") ?? "lead_coach"),
          }).catch(() => ({ ok: false as const, code: "error" }));
          if (!r.ok) return setMsg({ kind: "err", text: fail(r) });
          router.push(cohortId ? `/console/groups/${cohortId}` : "/console/volunteers?status=active");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={`${fid}-fn`}>{t("c.firstName")}</label>
          <input id={`${fid}-fn`} name="firstName" className="input" required maxLength={60} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-sn`}>{t("c.surname")}</label>
          <input id={`${fid}-sn`} name="surname" className="input" required maxLength={60} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-em`}>{t("c.email")}</label>
          <input id={`${fid}-em`} name="email" className="input" type="email" maxLength={200} autoComplete="off" />
          <span className="text-[14px] text-muted">{t("c.emailHelp")}</span>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-ph`}>{t("c.phone")}</label>
          <input id={`${fid}-ph`} name="phone" className="input" type="tel" maxLength={30} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-g`}>{t("c.gender")}</label>
          <select id={`${fid}-g`} name="gender" className="input" defaultValue="female">
            {(["female", "male", "other", "prefer_not_to_say"] as const).map((g) => (
              <option key={g} value={g}>
                {t(`c.g_${g}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-st`}>{t("c.state")}</label>
          <select id={`${fid}-st`} name="stateId" className="input" required defaultValue={states.length === 1 ? states[0]!.id : ""}>
            <option value="">{t("f.choose")}</option>
            {states.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor={`${fid}-oc`}>{t("c.occupation")}</label>
          <input id={`${fid}-oc`} name="occupation" className="input" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-grp`}>{t("c.group")}</label>
          <select id={`${fid}-grp`} name="cohortId" className="input" defaultValue={groupId ?? ""}>
            <option value="">{t("c.noGroup")}</option>
            {groups.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.school}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fid}-role`}>{t("role")}</label>
          <select id={`${fid}-role`} name="role" className="input" defaultValue="lead_coach">
            <option value="lead_coach">{t("lead_coach")}</option>
            <option value="assistant_coach">{t("assistant_coach")}</option>
          </select>
        </div>
      </div>
      <label className="opt items-start !p-4">
        <input type="checkbox" name="safeguardingChecked" required />
        <span className="grid gap-1">
          <span className="font-medium">{t("c.safeguarding")}</span>
          <span className="text-[14px] text-muted">{t("confirmSafeguardingHelp")}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending} aria-busy={pending}>
          {pending ? t("saving") : t("c.submit")}
        </button>
        <Note msg={msg} />
      </div>
    </form>
  );
}
