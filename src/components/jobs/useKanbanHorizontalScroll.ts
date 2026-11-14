import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const SCROLL_EDGE_TOLERANCE_PX = 8;

export interface KanbanHorizontalScrollState {
  showScrollButtons: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

function readScrollState(board: HTMLDivElement): KanbanHorizontalScrollState {
  const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
  const hasOverflow = maxScrollLeft > SCROLL_EDGE_TOLERANCE_PX;

  return {
    showScrollButtons: hasOverflow,
    canScrollLeft: hasOverflow && board.scrollLeft > SCROLL_EDGE_TOLERANCE_PX,
    canScrollRight:
      hasOverflow && board.scrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE_PX,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useKanbanHorizontalScroll(
  boardRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  layoutKey: string,
) {
  const [scrollState, setScrollState] = useState<KanbanHorizontalScrollState>({
    showScrollButtons: false,
    canScrollLeft: false,
    canScrollRight: false,
  });
  const rafRef = useRef<number | null>(null);

  const syncScrollState = useCallback(() => {
    const board = boardRef.current;
    if (!board || !enabled) {
      setScrollState({
        showScrollButtons: false,
        canScrollLeft: false,
        canScrollRight: false,
      });
      return;
    }
    setScrollState(readScrollState(board));
  }, [boardRef, enabled]);

  const scheduleSyncScrollState = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      syncScrollState();
    });
  }, [syncScrollState]);

  const getKanbanColumns = useCallback((): HTMLElement[] => {
    const board = boardRef.current;
    if (!board) return [];
    return Array.from(board.querySelectorAll<HTMLElement>('[data-kanban-column]'));
  }, [boardRef]);

  const scrollBoard = useCallback(
    (direction: 'left' | 'right') => {
      const board = boardRef.current;
      if (!board) return;

      const columns = getKanbanColumns();
      if (!columns.length) return;

      const scrollLeft = board.scrollLeft;
      const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

      if (direction === 'right') {
        const next = columns.find((col) => col.offsetLeft > scrollLeft + SCROLL_EDGE_TOLERANCE_PX);
        if (next) {
          next.scrollIntoView({ behavior, inline: 'start', block: 'nearest' });
        } else {
          board.scrollTo({ left: board.scrollWidth, behavior });
        }
      } else {
        const prev = [...columns]
          .reverse()
          .find((col) => col.offsetLeft < scrollLeft - SCROLL_EDGE_TOLERANCE_PX);
        if (prev) {
          prev.scrollIntoView({ behavior, inline: 'start', block: 'nearest' });
        } else {
          board.scrollTo({ left: 0, behavior });
        }
      }

      scheduleSyncScrollState();
    },
    [boardRef, getKanbanColumns, scheduleSyncScrollState],
  );

  const onBoardScroll = useCallback(() => {
    scheduleSyncScrollState();
  }, [scheduleSyncScrollState]);

  useEffect(() => {
    if (!enabled) {
      setScrollState({
        showScrollButtons: false,
        canScrollLeft: false,
        canScrollRight: false,
      });
      return;
    }

    const board = boardRef.current;
    if (!board) return;

    syncScrollState();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => scheduleSyncScrollState())
        : null;

    resizeObserver?.observe(board);
    board.parentElement && resizeObserver?.observe(board.parentElement);
    window.addEventListener('resize', scheduleSyncScrollState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleSyncScrollState);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [boardRef, enabled, layoutKey, scheduleSyncScrollState, syncScrollState]);

  return {
    ...scrollState,
    scrollBoard,
    onBoardScroll,
    syncScrollState,
  };
}
