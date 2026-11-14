import AgentWorkspace from "../cafy-agent/AgentWorkspace";
import type { CvActionResult } from "../../services/storage";
import type { Job, NewJobForm, SavedCV, User } from "../../types";

interface JobChatTabProps {
  user: User;
  savedCVs: SavedCV[];
  isCVsLoading?: boolean;
  jobs: Job[];
  addJob: (job: NewJobForm) => Promise<{ success: boolean; error?: string }>;
  uploadCV: (name: string, file: File) => Promise<CvActionResult>;
}

/**
 * Chat with CAFY runs the CAFY chat agent. It uses only CVs already saved in the user's
 * profile; there is no upload in the chat. Saved jobs feed the job tools in a later phase.
 */
export default function JobChatTab({ user, savedCVs, isCVsLoading }: JobChatTabProps) {
  return (
    <AgentWorkspace
      key={`agent:${user.uid}`}
      userId={user.uid}
      firstName={user.displayName?.trim().split(/\s+/)[0]}
      savedCVs={savedCVs}
      isCVsLoading={isCVsLoading}
      profileResume={user.resume}
    />
  );
}
