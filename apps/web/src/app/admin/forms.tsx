"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  addMember,
  createActivity,
  createAdult,
  createCohort,
  createStudent,
  deleteActivity,
  deleteCohort,
  deletePerson,
  linkGuardian,
  removeMember,
  resetStudentPassword,
  sendSignInLink,
  setAccountActive,
  unlinkGuardian,
  updateActivity,
  updateCohort,
  updateMembership,
  updatePerson,
  type ActionState,
} from "./actions";

const initial: ActionState = { status: "idle" };

function Result({ state }: { state: ActionState }) {
  const t = useTranslations("adminForms");
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {t(`errors.${state.message}`)}
        {state.detail ? ` (${state.detail})` : ""}
      </p>
    );
  }
  if (state.status === "ok") return <p role="status" className="text-sm text-success">{t(state.message ?? "saved")}</p>;
  return null;
}

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return ref;
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-[13px] text-soft">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function CreateCohortForm() {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(createCohort, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("groupName")}>
          <input name="name" required maxLength={80} placeholder="Group 2" className="field" />
        </Field>
        <Field label={t("startDate")}>
          <input name="startDate" type="date" className="field" />
        </Field>
        <Field label={t("timezone")}>
          <input name="timezone" defaultValue="Asia/Karachi" className="field" />
        </Field>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("createGroup")}</button>
    </form>
  );
}

type Schedule = { weekday?: number; start?: string; end?: string } | null;

export function CohortSettingsForm({ cohort }: { cohort: { id: string; name: string; start_date: string | null; timezone: string; schedule: Schedule } }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(updateCohort, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="cohortId" value={cohort.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("groupName")}>
          <input name="name" required defaultValue={cohort.name} className="field" />
        </Field>
        <Field label={t("startDate")}>
          <input name="startDate" type="date" defaultValue={cohort.start_date ?? ""} className="field" />
        </Field>
        <Field label={t("timezone")}>
          <input name="timezone" required defaultValue={cohort.timezone} className="field" />
        </Field>
        <Field label={t("classDay")}>
          <select name="weekday" defaultValue={cohort.schedule?.weekday ?? 6} className="field">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>{t(`days.${d}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("classStart")}>
          <input name="start" type="time" required defaultValue={cohort.schedule?.start ?? "11:00"} className="field" />
        </Field>
        <Field label={t("classEnd")}>
          <input name="end" type="time" required defaultValue={cohort.schedule?.end ?? "12:30"} className="field" />
        </Field>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("save")}</button>
    </form>
  );
}

export function DeleteCohortForm({ cohortId, name }: { cohortId: string; name: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(deleteCohort, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <p className="text-sm text-muted">{t("deleteGroupWarning", { name })}</p>
      <div className="flex flex-wrap gap-2">
        <input name="confirm" required autoComplete="off" placeholder={name} aria-label={t("typeToConfirm")} className="field max-w-xs py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="btn btn-danger px-3 py-1.5 text-sm">{t("deleteGroup")}</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function AddMemberForm({ cohortId, role, people }: { cohortId: string; role: "student" | "mentor"; people: { id: string; label: string }[] }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(addMember, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="role" value={role} />
      <div className="flex flex-wrap gap-2">
        <select name="userId" required defaultValue="" aria-label={t(role === "student" ? "pickStudent" : "pickMentor")} className="field max-w-xs">
          <option value="" disabled>{t(role === "student" ? "pickStudent" : "pickMentor")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {role === "student" && (
          <select name="ageGroup" required defaultValue="" aria-label={t("ageGroup")} className="field max-w-[12rem]">
            <option value="" disabled>{t("ageGroup")}</option>
            <option value="explorer">{t("ageGroups.explorer")}</option>
            <option value="builder">{t("ageGroups.builder")}</option>
          </select>
        )}
        <button type="submit" disabled={pending || people.length === 0} className="btn btn-secondary px-4 py-2 text-sm">{t("add")}</button>
      </div>
      {people.length === 0 && <p className="text-[13px] text-soft">{t(role === "student" ? "noFreeStudents" : "noFreeMentors")}</p>}
      <Result state={state} />
    </form>
  );
}

type MembershipRow = {
  id: string;
  age_group: "explorer" | "builder" | null;
  fee_amount: number | null;
  discount_reason: string | null;
  paid_at: string | null;
  refunded_at: string | null;
};

export function MembershipForm({ membership }: { membership: MembershipRow }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(updateMembership, initial);
  const payment = membership.refunded_at ? "refunded" : membership.paid_at ? "paid" : "unpaid";
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="membershipId" value={membership.id} />
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-soft">{t("ageGroup")}</span>
        <select name="ageGroup" defaultValue={membership.age_group ?? "explorer"} className="field py-1.5 text-sm">
          <option value="explorer">{t("ageGroups.explorer")}</option>
          <option value="builder">{t("ageGroups.builder")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-soft">{t("fee")}</span>
        <input name="fee" type="number" min={0} step="1" defaultValue={membership.fee_amount ?? ""} className="field w-28 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-soft">{t("discount")}</span>
        <input name="discount" defaultValue={membership.discount_reason ?? ""} placeholder={t("discountPlaceholder")} className="field w-36 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-soft">{t("payment")}</span>
        <select name="payment" defaultValue={payment} className="field py-1.5 text-sm">
          <option value="unpaid">{t("payments.unpaid")}</option>
          <option value="paid">{t("payments.paid")}</option>
          <option value="refunded">{t("payments.refunded")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn btn-secondary px-3 py-1.5 text-sm">{t("save")}</button>
      <Result state={state} />
    </form>
  );
}

export function RemoveMemberButton({ membershipId }: { membershipId: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(removeMember, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <button type="submit" disabled={pending} className="text-[13px] text-danger underline">{t("removeFromGroup")}</button>
      <Result state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function AddStudentForm({
  parents,
  cohorts,
  defaultParentId,
}: {
  parents: { id: string; label: string }[];
  cohorts: { id: string; name: string }[];
  defaultParentId?: string;
}) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(createStudent, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fullName")}>
          <input name="fullName" required maxLength={80} className="field" />
        </Field>
        <Field label={t("birthYear")}>
          <input name="birthYear" type="number" inputMode="numeric" required className="field" />
        </Field>
        <Field label={t("username")} hint={t("usernameHint")}>
          <input name="username" required autoCapitalize="none" spellCheck={false} autoComplete="off" className="field" />
        </Field>
        <Field label={t("password")} hint={t("passwordHint")}>
          <input name="password" type="text" required minLength={8} autoComplete="off" className="field" />
        </Field>
        <Field label={t("parent")} hint={t("parentHint")}>
          <select name="parentId" required defaultValue={defaultParentId ?? ""} className="field">
            <option value="" disabled>{t("pickParent")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("groupOptional")}>
            <select name="cohortId" defaultValue="" className="field">
              <option value="">{t("noGroup")}</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("ageGroup")}>
            <select name="ageGroup" defaultValue="" className="field">
              <option value="">—</option>
              <option value="explorer">{t("ageGroups.explorer")}</option>
              <option value="builder">{t("ageGroups.builder")}</option>
            </select>
          </Field>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-4">
        <input name="consentSigned" type="checkbox" required className="mt-1 size-4 accent-cyan" />
        <span className="text-sm text-muted">{t("consentSigned")}</span>
      </label>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start">{t("createStudent")}</button>
    </form>
  );
}

export function AddAdultForm({
  cohorts,
  devMode,
  defaultRole,
}: {
  cohorts: { id: string; name: string }[];
  devMode: boolean;
  defaultRole: "parent" | "mentor" | "admin";
}) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(createAdult, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fullName")}>
          <input name="fullName" required maxLength={80} className="field" />
        </Field>
        <Field label={t("email")}>
          <input name="email" type="email" required className="field" />
        </Field>
        <Field label={t("role")}>
          <select name="role" defaultValue={defaultRole} className="field">
            <option value="parent">{t("roles.parent")}</option>
            <option value="mentor">{t("roles.mentor")}</option>
            <option value="admin">{t("roles.admin")}</option>
          </select>
        </Field>
        <Field label={t("mentorGroup")}>
          <select name="cohortId" defaultValue="" className="field">
            <option value="">{t("noGroup")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        {devMode && (
          <Field label={t("tempPassword")} hint={t("tempPasswordHint")} className="sm:col-span-2">
            <input name="tempPassword" type="text" autoComplete="off" minLength={8} className="field" />
          </Field>
        )}
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start">{t("invite")}</button>
    </form>
  );
}

type EditablePerson = {
  id: string;
  role: "student" | "parent" | "mentor" | "admin";
  full_name: string;
  username: string | null;
  birth_year: number | null;
  country: string | null;
  timezone: string;
  prefers_female_mentor: boolean;
};

export function EditPersonForm({ person, email, isSelf }: { person: EditablePerson; email: string; isSelf: boolean }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(updatePerson, initial);
  const isStudent = person.role === "student";
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={person.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fullName")}>
          <input name="fullName" required defaultValue={person.full_name} className="field" />
        </Field>
        {isStudent ? (
          <>
            <Field label={t("username")} hint={t("usernameChangeHint")}>
              <input name="username" required defaultValue={person.username ?? ""} autoCapitalize="none" spellCheck={false} className="field" />
            </Field>
            <Field label={t("birthYear")}>
              <input name="birthYear" type="number" required defaultValue={person.birth_year ?? ""} className="field" />
            </Field>
          </>
        ) : (
          <>
            <Field label={t("email")} hint={t("emailChangeHint")}>
              <input name="email" type="email" required defaultValue={email} className="field" />
            </Field>
            <Field label={t("role")} hint={isSelf ? t("ownRoleHint") : undefined}>
              <select name="role" defaultValue={person.role} disabled={isSelf} className="field">
                <option value="parent">{t("roles.parent")}</option>
                <option value="mentor">{t("roles.mentor")}</option>
                <option value="admin">{t("roles.admin")}</option>
              </select>
              {isSelf && <input type="hidden" name="role" value={person.role} />}
            </Field>
          </>
        )}
        <Field label={t("country")}>
          <input name="country" defaultValue={person.country ?? ""} placeholder="Pakistan" className="field" />
        </Field>
        <Field label={t("timezone")}>
          <input name="timezone" defaultValue={person.timezone} className="field" />
        </Field>
      </div>
      {isStudent && (
        <label className="flex items-center gap-3">
          <input name="prefersFemaleMentor" type="checkbox" defaultChecked={person.prefers_female_mentor} className="size-4 accent-cyan" />
          <span className="text-sm">{t("prefersFemaleMentor")}</span>
        </label>
      )}
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("saveChanges")}</button>
    </form>
  );
}

export function ResetStudentPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(resetStudentPassword, initial);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap gap-2">
        <input name="password" type="text" required minLength={8} autoComplete="off" placeholder={t("newPassword")} aria-label={t("newPassword")} className="field max-w-xs py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="btn btn-secondary px-3 py-1.5 text-sm">{t("setPassword")}</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function SendLinkButton({ userId }: { userId: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(sendSignInLink, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className="btn btn-secondary self-start px-3 py-1.5 text-sm">{t("sendLink")}</button>
      <Result state={state} />
    </form>
  );
}

export function AccountActiveForm({ userId, active }: { userId: string; active: boolean }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(setAccountActive, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button type="submit" disabled={pending} className={`btn self-start px-3 py-1.5 text-sm ${active ? "btn-secondary" : "btn-primary"}`}>
        {active ? t("deactivate") : t("reactivate")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function LinkGuardianForm({
  fixed,
  fixedId,
  options,
}: {
  fixed: "parent" | "student";
  fixedId: string;
  options: { id: string; label: string }[];
}) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(linkGuardian, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name={fixed === "parent" ? "parentId" : "studentId"} value={fixedId} />
      <div className="flex flex-wrap gap-2">
        <select name={fixed === "parent" ? "studentId" : "parentId"} required defaultValue="" aria-label={t(fixed === "parent" ? "pickStudent" : "pickParent")} className="field max-w-xs py-1.5 text-sm">
          <option value="" disabled>{t(fixed === "parent" ? "pickStudent" : "pickParent")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button type="submit" disabled={pending || options.length === 0} className="btn btn-secondary px-3 py-1.5 text-sm">{t("link")}</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function UnlinkButton({ linkId }: { linkId: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(unlinkGuardian, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" disabled={pending} className="text-[13px] text-danger underline">{t("unlink")}</button>
      <Result state={state} />
    </form>
  );
}

export function DeletePersonForm({ userId, confirmWith }: { userId: string; confirmWith: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(deletePerson, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-muted">{t("deleteWarning", { value: confirmWith })}</p>
      <div className="flex flex-wrap gap-2">
        <input name="confirm" required autoComplete="off" placeholder={confirmWith} aria-label={t("typeToConfirm")} className="field max-w-xs py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="btn btn-danger px-3 py-1.5 text-sm">{t("deleteForever")}</button>
      </div>
      <Result state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

type ActivityValues = {
  id?: string;
  title: string;
  instructions: string;
  week: number;
  position: number;
  age_group: "explorer" | "builder" | null;
  submission_type: "text" | "file" | "link" | "text_and_file";
};

export function ActivityForm({ stageId, weeks, activity }: { stageId: string; weeks: number[]; activity?: ActivityValues }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(activity ? updateActivity : createActivity, initial);
  const ref = useResetOnSuccess(activity ? initial : state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="stageId" value={stageId} />
      {activity?.id && <input type="hidden" name="activityId" value={activity.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("activityTitle")} className="sm:col-span-4">
          <input name="title" required maxLength={120} defaultValue={activity?.title} className="field" />
        </Field>
        <Field label={t("instructions")} className="sm:col-span-4">
          <textarea name="instructions" required rows={3} maxLength={4000} defaultValue={activity?.instructions} className="field resize-y" />
        </Field>
        <Field label={t("week")}>
          <select name="week" defaultValue={activity?.week ?? weeks[0]} className="field">
            {weeks.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </Field>
        <Field label={t("order")}>
          <input name="position" type="number" min={0} defaultValue={activity?.position ?? 1} className="field" />
        </Field>
        <Field label={t("ageGroup")}>
          <select name="ageGroup" defaultValue={activity?.age_group ?? ""} className="field">
            <option value="">{t("bothAgeGroups")}</option>
            <option value="explorer">{t("ageGroups.explorer")}</option>
            <option value="builder">{t("ageGroups.builder")}</option>
          </select>
        </Field>
        <Field label={t("submissionType")}>
          <select name="submissionType" defaultValue={activity?.submission_type ?? "text"} className="field">
            {(["text", "file", "link", "text_and_file"] as const).map((s) => (
              <option key={s} value={s}>{t(`submissionTypes.${s}`)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary self-start px-4 py-2 text-sm">
        {activity ? t("save") : t("addActivity")}
      </button>
    </form>
  );
}

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(deleteActivity, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit" disabled={pending} className="text-[13px] text-danger underline">{t("deleteActivity")}</button>
      <Result state={state} />
    </form>
  );
}
