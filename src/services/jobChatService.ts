import { auth } from "./firebase";
import { getBackendUrl } from "./apiConfig";
import { normalizeJobChatResponse } from "./jobChatContract";
import type { JobChatRequest, JobChatResponse } from "./jobChatContract";
export type {
  JobChatRequest,
  JobChatResponse,
  JobChatSearch,
  JobChatWebStatus,
  JobChatGroundedWeb,
  JobChatGroundedWebStatus,
  JobChatMode,
  JobChatGuidance,
  JobChatWebDiscovery,
} from "./jobChatContract";

export async function searchJobsInChat(
  request: JobChatRequest,
  signal?: AbortSignal,
): Promise<JobChatResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to use CAFY career support.");
  const token = await user.getIdToken();
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 75_000);
  try {
    const response = await fetch(`${getBackendUrl()}/api/jobs-portal/chat`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const result = await response.json().catch((failure: unknown) => {
      if (controller.signal.aborted) throw failure;
      return null;
    });
    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.error ||
          "CAFY career support is unavailable. Please try again.",
      );
    }
    const validated = normalizeJobChatResponse(result);
    if (!validated) {
      throw new Error(
        "CAFY returned an incomplete response. Please try again.",
      );
    }
    return validated;
  } catch (failure) {
    if (timedOut)
      throw new Error(
        "This response took too long. Your message is ready to try again.",
      );
    throw failure;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
