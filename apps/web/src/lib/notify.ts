import "server-only";

/**
 * Single entry point for messages to people. MVP: email through Resend.
 * Later: WhatsApp and SMS channels behind the same function.
 */
export type Notification = {
  to: string;
  subject: string;
  html: string;
  channel?: "email";
};

export async function notify({ to, subject, html }: Notification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[notify] email to ${to}: ${subject}`);
      return;
    }
    throw new Error("Email is not configured (RESEND_API_KEY / NOTIFY_FROM_EMAIL)");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
}
