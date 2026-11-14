import type { ReactNode } from "react";
import type { AgentBlock } from "../../../services/agentContract";
import AnswerCard from "./AnswerCard";
import CvProfileCard from "./CvProfileCard";
import OfficialFacts from "./OfficialFacts";
import SocCards from "./SocCards";
import SponsorList from "./SponsorList";
import JobList from "./JobList";
import OfficialSources from "./OfficialSources";
import JobCompare from "./JobCompare";
import SkillGaps from "./SkillGaps";

/**
 * Maps a block kind from the server to its component. New blocks (job cards, salary chart,
 * document editor…) register here; unknown kinds render nothing.
 */
export function AgentBlockView({ block, cvPicker, onAsk, onQuote }: { block: AgentBlock; cvPicker?: ReactNode; onAsk?: (question: string) => void; onQuote?: (text: string) => void }) {
  switch (block.kind) {
    case "answerCard":
      return <AnswerCard pieces={block.pieces} onQuote={onQuote} />;
    case "cvProfile":
      return <CvProfileCard card={block.card} />;
    case "socCards":
      return <SocCards card={block.card} onAsk={onAsk} />;
    case "officialFacts":
      return <OfficialFacts card={block.card} />;
    case "sponsorList":
      return <SponsorList card={block.card} onAsk={onAsk} />;
    case "jobList":
      return <JobList card={block.card} onAsk={onAsk} />;
    case "officialSources":
      return <OfficialSources card={block.card} />;
    case "jobCompare":
      return <JobCompare card={block.card} onAsk={onAsk} />;
    case "skillGaps":
      return <SkillGaps card={block.card} onAsk={onAsk} />;
    case "cvPicker":
      return cvPicker ? (
        <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-slate-700">Choose a CV so I can answer from it</p>
          {cvPicker}
        </div>
      ) : null;
    default:
      return null;
  }
}
