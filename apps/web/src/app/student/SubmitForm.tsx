"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { submitWork, type ActionState } from "./actions";

type SubmissionType = Database["public"]["Enums"]["submission_type"];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,text/plain,.pptx,.docx";
const initial: ActionState = { status: "idle" };

export function SubmitForm({
  activityId,
  cohortId,
  studentId,
  submissionType,
  isResubmission,
}: {
  activityId: string;
  cohortId: string;
  studentId: string;
  submissionType: SubmissionType;
  isResubmission: boolean;
}) {
  const t = useTranslations("submit");
  const [state, action, pending] = useActionState(submitWork, initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const wantsText = submissionType === "text" || submissionType === "text_and_file";
  const wantsFile = submissionType === "file" || submissionType === "text_and_file";
  const wantsLink = submissionType === "link";

  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    const formData = new FormData(event.currentTarget);
    const picked = Array.from(filesRef.current?.files ?? []);

    if (picked.some((f) => f.size > MAX_FILE_BYTES)) {
      setUploadError(t("errors.tooBig"));
      return;
    }

    const uploaded: { path: string; name: string; type: string; size: number }[] = [];
    if (picked.length > 0) {
      setUploading(true);
      const supabase = createClient();
      for (const file of picked) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${cohortId}/${studentId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("submissions").upload(path, file, { contentType: file.type });
        if (error) {
          setUploading(false);
          setUploadError(t("errors.upload"));
          return;
        }
        uploaded.push({ path, name: file.name, type: file.type, size: file.size });
      }
      setUploading(false);
    }

    formData.set("files", JSON.stringify(uploaded));
    startTransition(() => action(formData));
  }

  const busy = pending || uploading;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card flex flex-col gap-4 p-5">
      <h2 className="font-display-tight text-lg">{isResubmission ? t("titleAgain") : t("title")}</h2>
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="cohortId" value={cohortId} />

      {(wantsText || wantsLink) && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{wantsLink ? t("noteOptional") : t("answer")}</span>
          <textarea name="body" rows={wantsLink ? 3 : 7} maxLength={10000} className="field resize-y" />
        </label>
      )}
      {wantsLink && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("link")}</span>
          <input name="linkUrl" type="url" inputMode="url" placeholder="https://" className="field" />
        </label>
      )}
      {wantsFile && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("files")}</span>
          <input ref={filesRef} type="file" multiple accept={ACCEPT} className="field file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm" />
          <span className="text-[13px] text-soft">{t("filesHint")}</span>
        </label>
      )}

      {(uploadError || state.status === "error") && (
        <p role="alert" className="text-sm text-danger">{uploadError ?? t(`errors.${state.message}`)}</p>
      )}
      {state.status === "ok" && <p role="status" className="text-sm text-success">{t("sent")}</p>}

      <button type="submit" disabled={busy} className="btn btn-primary self-start">
        {uploading ? t("uploading") : pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
