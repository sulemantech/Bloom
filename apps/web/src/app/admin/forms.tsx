"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  addMember,
  createCohort,
  deleteStudent,
  invitePerson,
  removeMember,
  updateCohort,
  updateMembership,
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

export function CreateCohortForm() {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(createCohort, initial);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("groupName")}</span>
          <input name="name" required maxLength={80} placeholder="Group 2" className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("startDate")}</span>
          <input name="startDate" type="date" className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("timezone")}</span>
          <input name="timezone" defaultValue="Asia/Karachi" className="field" />
        </label>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("createGroup")}</button>
    </form>
  );
}

export function InviteForm({ cohorts, devMode }: { cohorts: { id: string; name: string }[]; devMode: boolean }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(invitePerson, initial);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("fullName")}</span>
          <input name="fullName" required maxLength={80} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("email")}</span>
          <input name="email" type="email" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("role")}</span>
          <select name="role" className="field">
            <option value="parent">{t("roles.parent")}</option>
            <option value="mentor">{t("roles.mentor")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("mentorGroup")}</span>
          <select name="cohortId" className="field">
            <option value="">{t("noGroup")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {devMode && (
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-warning">{t("tempPassword")}</span>
            <input name="tempPassword" type="text" autoComplete="off" minLength={8} className="field" />
            <span className="text-[13px] text-soft">{t("tempPasswordHint")}</span>
          </label>
        )}
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("invite")}</button>
    </form>
  );
}

export function CohortSettingsForm({
  cohort,
}: {
  cohort: { id: string; name: string; start_date: string | null; timezone: string; schedule: { weekday?: number; start?: string; end?: string } | null };
}) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(updateCohort, initial);
  const days = [0, 1, 2, 3, 4, 5, 6];
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="cohortId" value={cohort.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("groupName")}</span>
          <input name="name" required defaultValue={cohort.name} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("startDate")}</span>
          <input name="startDate" type="date" defaultValue={cohort.start_date ?? ""} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("timezone")}</span>
          <input name="timezone" required defaultValue={cohort.timezone} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("classDay")}</span>
          <select name="weekday" defaultValue={cohort.schedule?.weekday ?? 6} className="field">
            {days.map((d) => (
              <option key={d} value={d}>{t(`days.${d}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("classStart")}</span>
          <input name="start" type="time" required defaultValue={cohort.schedule?.start ?? "11:00"} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("classEnd")}</span>
          <input name="end" type="time" required defaultValue={cohort.schedule?.end ?? "12:30"} className="field" />
        </label>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary self-start px-4 py-2 text-sm">{t("save")}</button>
    </form>
  );
}

export function AddMemberForm({
  cohortId,
  role,
  people,
}: {
  cohortId: string;
  role: "student" | "mentor";
  people: { id: string; label: string }[];
}) {
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

export function MembershipForm({
  membership,
}: {
  membership: { id: string; age_group: "explorer" | "builder" | null; fee_amount: number | null; discount_reason: string | null; paid_at: string | null; refunded_at: string | null };
}) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(updateMembership, initial);
  const [removeState, removeAction, removing] = useActionState(removeMember, initial);
  const payment = membership.refunded_at ? "refunded" : membership.paid_at ? "paid" : "unpaid";
  return (
    <div className="flex flex-col gap-2">
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
      </form>
      <form action={removeAction}>
        <input type="hidden" name="membershipId" value={membership.id} />
        <button type="submit" disabled={removing} className="text-[13px] text-danger underline">{t("removeFromGroup")}</button>
      </form>
      <Result state={state.status !== "idle" ? state : removeState} />
    </div>
  );
}

export function RemoveMentorButton({ membershipId }: { membershipId: string }) {
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

export function DeleteStudentForm({ studentId, username }: { studentId: string; username: string }) {
  const t = useTranslations("adminForms");
  const [state, action, pending] = useActionState(deleteStudent, initial);
  return (
    <details>
      <summary className="cursor-pointer text-[13px] text-danger">{t("deleteStudent")}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-xl border border-danger/40 p-3">
        <input type="hidden" name="studentId" value={studentId} />
        <p className="text-sm text-muted">{t("deleteWarning", { username })}</p>
        <div className="flex flex-wrap gap-2">
          <input name="confirm" required autoComplete="off" placeholder={username} aria-label={t("typeUsername")} className="field max-w-xs py-1.5 text-sm" />
          <button type="submit" disabled={pending} className="btn btn-danger px-3 py-1.5 text-sm">{t("deleteForever")}</button>
        </div>
        <Result state={state} />
      </form>
    </details>
  );
}
