import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

export async function register() {
  Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
