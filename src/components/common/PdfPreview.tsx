import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  linkUrlFromAnnotation,
  reconstructClickableLinks,
  type PdfTextRun,
} from './pdfLinkify';

interface PdfPreviewProps {
  url: string;
}

type Box = { left: number; top: number; width: number; height: number };

type TextRun = {
  el?: HTMLElement;
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const STYLE_ID = 'cafy-pdf-text-layer-style';

function ensureTextLayerStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cafy-pdf-text-layer {
      position: absolute;
      inset: 0;
      overflow: hidden;
      line-height: 1;
      z-index: 1;
      --min-font-size: 1;
      --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
      --min-font-size-inv: 1;
    }
    .cafy-pdf-text-layer > span {
      color: transparent;
      position: absolute;
      white-space: pre;
      transform-origin: 0% 0%;
      pointer-events: none;
      z-index: 1;
      font-size: calc(var(--text-scale-factor) * var(--font-height, 1));
      transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1));
    }
    .cafy-pdf-text-layer > span.cafy-pdf-link {
      pointer-events: auto;
      cursor: pointer;
    }
    .cafy-pdf-text-layer > span.cafy-pdf-link:hover {
      background: rgba(26, 86, 219, 0.14);
    }
    .cafy-pdf-links {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function viewportRect(
  viewport: { convertToViewportRectangle: (rect: number[]) => number[] },
  rect: number[]
): Box {
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return {
    left,
    top,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function appendClickableLink(overlay: HTMLElement, box: Box, href: string) {
  if (box.width < 2 || box.height < 2) return;
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = href;
  link.setAttribute('aria-label', `Open ${href}`);
  link.style.position = 'absolute';
  link.style.left = `${box.left}px`;
  link.style.top = `${box.top}px`;
  link.style.width = `${box.width}px`;
  link.style.height = `${Math.max(box.height, 12)}px`;
  link.style.pointerEvents = 'auto';
  link.style.cursor = 'pointer';
  link.style.borderRadius = '2px';
  link.style.background = 'transparent';
  link.addEventListener('mouseenter', () => {
    link.style.background = 'rgba(26, 86, 219, 0.12)';
  });
  link.addEventListener('mouseleave', () => {
    link.style.background = 'transparent';
  });
  overlay.appendChild(link);
}

function markRunAsLink(run: TextRun, href: string) {
  if (!run.el) return;
  run.el.classList.add('cafy-pdf-link');
  run.el.setAttribute('role', 'link');
  run.el.setAttribute('title', href);
  run.el.dataset.href = href;
  run.el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  });
}

function overlayUrlsFromText(overlay: HTMLElement, runs: TextRun[]) {
  const links = reconstructClickableLinks(runs as PdfTextRun[]);
  for (const link of links) {
    for (const run of link.runs) {
      markRunAsLink(run as TextRun, link.href);
      appendClickableLink(overlay, {
        left: run.left,
        top: run.top,
        width: Math.max(run.width, 8),
        height: Math.max(run.height, 12),
      }, link.href);
    }
  }
}

function runsFromTextLayer(
  divs: HTMLElement[],
  strings: string[],
  pageWrap: HTMLElement
): TextRun[] {
  const pageBox = pageWrap.getBoundingClientRect();
  const runs: TextRun[] = [];
  for (let i = 0; i < divs.length; i++) {
    const el = divs[i];
    const str = strings[i] ?? el.textContent ?? '';
    if (!str) continue;
    const box = el.getBoundingClientRect();
    runs.push({
      el,
      str,
      left: box.left - pageBox.left,
      top: box.top - pageBox.top,
      width: Math.max(box.width, parseFloat(el.style.left) ? el.offsetWidth : 0),
      height: Math.max(box.height, el.offsetHeight, 12),
    });
  }
  return runs;
}

/**
 * Renders a PDF to <canvas> using pdfjs-dist, with a text layer on top so
 * every http(s)/www URL is clickable — including ones that wrap onto a
 * second line and were never stored as PDF hyperlink annotations.
 */
export default function PdfPreview({ url }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pdfDoc: { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void } | null =
      null;

    const render = async () => {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);
      ensureTextLayerStyles();

      try {
        const module: any = await import(/* @vite-ignore */ 'pdfjs-dist');
        const pdfjsLib = module.default || module;

        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch document');
        const arrayBuffer = await response.arrayBuffer();

        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted || !containerRef.current || !pdfDoc) return;

        const container = containerRef.current;
        container.innerHTML = '';

        const availableWidth = Math.max(240, container.clientWidth - 16);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const TextLayer = pdfjsLib.TextLayer;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          if (!isMounted) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = availableWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const pageWrap = document.createElement('div');
          pageWrap.className =
            'relative mx-auto mb-4 rounded-lg border border-slate-200 shadow-md bg-white max-w-full';
          pageWrap.style.width = `${Math.floor(viewport.width)}px`;
          pageWrap.style.height = `${Math.floor(viewport.height)}px`;

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.className = 'block max-w-full';

          pageWrap.appendChild(canvas);
          container.appendChild(pageWrap);

          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;

          const overlay = document.createElement('div');
          overlay.className = 'cafy-pdf-links';

          const annotations: Array<Record<string, unknown>> = await page.getAnnotations({
            intent: 'display',
          });
          for (const annot of annotations) {
            const href = linkUrlFromAnnotation(annot);
            if (!href || !Array.isArray(annot.rect) || annot.rect.length < 4) continue;
            appendClickableLink(overlay, viewportRect(viewport, annot.rect as number[]), href);
          }

          if (TextLayer) {
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'cafy-pdf-text-layer';
            textLayerDiv.style.setProperty('--total-scale-factor', String(viewport.scale));
            pageWrap.appendChild(textLayerDiv);

            const textLayer = new TextLayer({
              textContentSource: await page.getTextContent(),
              container: textLayerDiv,
              viewport,
            });
            await textLayer.render();

            const runs = runsFromTextLayer(
              textLayer.textDivs || [],
              textLayer.textContentItemsStr || [],
              pageWrap
            );
            overlayUrlsFromText(overlay, runs);
          }

          pageWrap.appendChild(overlay);
        }

        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('PDF preview error:', err);
        if (isMounted) {
          setError('Failed to render the document.');
          setLoading(false);
        }
      }
    };

    render();

    return () => {
      isMounted = false;
      try {
        pdfDoc?.destroy();
      } catch {
        // ignore teardown errors
      }
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-sm text-rose-600 font-semibold p-6 bg-white rounded-lg shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100/70 backdrop-blur-sm">
          <Loader2 className="h-7 w-7 animate-spin text-cafy-500" aria-hidden />
          <p className="text-sm font-medium text-slate-500">Loading document…</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full overflow-y-auto custom-scrollbar py-2" />
    </div>
  );
}
