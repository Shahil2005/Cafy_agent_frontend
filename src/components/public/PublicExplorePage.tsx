/**
 * Logged-out landing page: the same Find / Apply / Grow tools as the Home page.
 * Jobs opens the free preview; the Chrome Web Store link is public; every other
 * tool opens the sign-up popup and, after auth, the user lands on that tool.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolGroupsGrid from '../home/ToolGroupsGrid';
import { buildHomeToolGroups, type HomeTool } from '../home/homeToolGroups';
import SignupGateDialog from '../jobs-portal/public/SignupGateDialog';
import {
  clearAnonJobPreferences,
  consumePendingJobsIntent,
  savePendingJobsIntent,
} from '../jobs-portal/public/publicJobsStorage';
import { captureProductEvent } from '../../lib/observability/posthog';
import { ProductEvents } from '../../lib/observability/events';
import PublicHeader from './PublicHeader';
import PublicHero from './PublicHero';

const PREVIEW_TOOL_PATHS: Partial<Record<HomeTool['id'], string>> = {
  jobs: '/explore-jobs',
  'part-time-jobs': '/explore-part-time-jobs',
};

/** Tools that are already public outside the app (no account needed). */
const PUBLIC_EXTERNAL_TOOLS = new Set<HomeTool['id']>(['chrome-extension']);

export default function PublicExplorePage() {
  const navigate = useNavigate();
  const groups = useMemo(() => buildHomeToolGroups('/sponsorship'), []);
  const [lockedTool, setLockedTool] = useState<HomeTool | null>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    captureProductEvent(ProductEvents.PUBLIC_EXPLORE_VIEWED);
    return () => {
      meta.remove();
    };
  }, []);

  const openTool = useCallback(
    (tool: HomeTool, source: 'hero' | 'card') => {
      captureProductEvent(ProductEvents.PUBLIC_FEATURE_CLICKED, { tool: tool.id, source });
      const previewPath = PREVIEW_TOOL_PATHS[tool.id];
      if (previewPath) {
        // Every visit from the Jobs card starts with an empty preferences form;
        // jobs are shown only after the visitor fills it in.
        if (tool.id === 'jobs') clearAnonJobPreferences();
        navigate(previewPath);
        return;
      }
      if (PUBLIC_EXTERNAL_TOOLS.has(tool.id) && tool.href) {
        window.open(tool.href, '_blank', 'noopener,noreferrer');
        return;
      }
      setLockedTool(tool);
    },
    [navigate],
  );

  const handleToolClick = useCallback((tool: HomeTool) => openTool(tool, 'card'), [openTool]);

  const openPreviewFromHero = (id: HomeTool['id']) => {
    const tool = groups.flatMap((g) => g.tools).find((t) => t.id === id);
    if (tool) openTool(tool, 'hero');
  };

  /** Header buttons: plain sign-up / sign-in (no remembered destination). */
  const goToAuthFromHeader = (mode: 'signup' | 'login') => {
    consumePendingJobsIntent();
    navigate(mode === 'signup' ? '/signup' : '/login');
  };

  /** Popup buttons: remember the tool so the user lands there after auth. */
  const goToAuthForTool = (mode: 'signup' | 'login') => {
    if (lockedTool) savePendingJobsIntent({ toolId: lockedTool.id });
    setLockedTool(null);
    navigate(mode === 'signup' ? '/signup' : '/login');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-inter">
      <PublicHeader
        onSignIn={() => goToAuthFromHeader('login')}
        onGetStarted={() => goToAuthFromHeader('signup')}
      />

      <main className="custom-scrollbar flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full flex-col gap-5 px-4 py-5 sm:px-6">
          <PublicHero
            onPreviewJobs={() => openPreviewFromHero('jobs')}
            onPreviewPartTime={() => openPreviewFromHero('part-time-jobs')}
          />

          <ToolGroupsGrid
            compact
            groups={groups}
            onToolClick={handleToolClick}
            badgeFor={(tool) => (PREVIEW_TOOL_PATHS[tool.id] ? 'Free preview' : null)}
            highlightFor={(tool) => Boolean(PREVIEW_TOOL_PATHS[tool.id])}
            lockedFor={(tool) => !PREVIEW_TOOL_PATHS[tool.id] && !PUBLIC_EXTERNAL_TOOLS.has(tool.id)}
          />
        </div>
      </main>

      <SignupGateDialog
        action={lockedTool ? 'feature' : null}
        moreLabel={null}
        feature={lockedTool ? { title: lockedTool.title, blurb: lockedTool.blurb } : null}
        onSignup={() => goToAuthForTool('signup')}
        onLogin={() => goToAuthForTool('login')}
        onClose={() => setLockedTool(null)}
      />
    </div>
  );
}
