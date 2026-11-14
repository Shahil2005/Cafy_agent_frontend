/**
 * Checks every Resources directory PDF: each visible http(s)/www URL must
 * become a clickable overlay using the same logic as PdfPreview.
 *
 * Usage (from Product-Site):
 *   npx tsx scripts/checkResourcePdfLinks.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  linkUrlFromAnnotation,
  reconstructClickableLinks,
  uniqueHrefs,
  type PdfTextRun,
} from '../src/components/common/pdfLinkify';

const FILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../ProductBackend/resources/files'
);

function hrefKey(href: string) {
  return href.replace(/\/$/, '').toLowerCase();
}

function runsFromPageItems(
  items: Array<Record<string, unknown>>,
  viewport: {
    scale: number;
    convertToViewportPoint: (x: number, y: number) => number[];
  }
): PdfTextRun[] {
  const runs: PdfTextRun[] = [];
  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    if (!str) continue;
    const transform = item.transform as number[] | undefined;
    if (!Array.isArray(transform) || transform.length < 6) continue;
    const [left, baseline] = viewport.convertToViewportPoint(transform[4], transform[5]);
    const itemHeight =
      typeof item.height === 'number' ? item.height : Math.abs(transform[3] || 0);
    const itemWidth = typeof item.width === 'number' ? item.width : 0;
    const height = Math.max(8, itemHeight * viewport.scale);
    runs.push({
      str,
      left,
      top: baseline - height,
      width: itemWidth * viewport.scale,
      height,
    });
  }
  return runs;
}

async function main() {
  const pdfjsLib = await import(
    pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
  );

  const files = fs
    .readdirSync(FILES_DIR)
    .filter((f) => f.endsWith('.pdf'))
    .sort();

  let failed = 0;
  const report: Array<{
    file: string;
    directoryLinks: number;
    clickable: number;
    missing: Array<{ href: string; page: number; note: string }>;
    eastRiding?: string;
  }> = [];

  for (const file of files) {
    const data = new Uint8Array(fs.readFileSync(path.join(FILES_DIR, file)));
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const missing: Array<{ href: string; page: number; note: string }> = [];
    const allClickable: string[] = [];
    let eastRiding: string | undefined;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const annots = await page.getAnnotations({ intent: 'display' });
      const annotHrefs = annots
        .map((a: Record<string, unknown>) => linkUrlFromAnnotation(a))
        .filter(Boolean) as string[];

      const textContent = await page.getTextContent();
      const runs = runsFromPageItems(
        (textContent.items || []) as Array<Record<string, unknown>>,
        viewport
      );
      const textLinks = reconstructClickableLinks(runs);
      allClickable.push(...textLinks.map((l) => l.href), ...annotHrefs);

      for (const link of textLinks) {
        if (/eastriding/i.test(link.href)) {
          eastRiding = `page ${p}: ${link.href} (${link.runs.length} hit targets)`;
        }
        const hasBox = link.runs.some((r) => r.width >= 2 && r.height >= 2);
        if (!hasBox) {
          missing.push({ href: link.href, page: p, note: 'no hit-target box' });
        }
        if (/https?:\/\/.+\-$/i.test(link.href.replace(/\/$/, ''))) {
          const coveredByAnnot = annotHrefs.some(
            (h) => hrefKey(h).startsWith(hrefKey(link.href).replace(/-$/, ''))
          );
          if (!coveredByAnnot) {
            missing.push({
              href: link.href,
              page: p,
              note: 'wrapped URL still truncated (second line not joined)',
            });
          }
        }
      }

      for (const run of runs) {
        if (!/^https?:\/\//i.test(run.str) || !run.str.trim().endsWith('-')) continue;
        const covering = textLinks.find((l) => l.runs.includes(run));
        const joined =
          covering &&
          hrefKey(covering.href) !== hrefKey(run.str) &&
          !covering.href.replace(/\/$/, '').endsWith('-');
        const coveredByAnnot = annotHrefs.some(
          (h) => hrefKey(h).startsWith(hrefKey(run.str).replace(/-$/, '')) || hrefKey(run.str).startsWith(hrefKey(h))
        );
        if (!joined && !coveredByAnnot) {
          missing.push({
            href: run.str,
            page: p,
            note: 'first-line wrap fragment has no joined continuation',
          });
        }
      }
    }

    const directoryHrefs = uniqueHrefs(allClickable).filter(
      (h) => !/cafy\.careers/i.test(h)
    );

    report.push({
      file,
      directoryLinks: directoryHrefs.length,
      clickable: directoryHrefs.length,
      missing: missing.filter((m) => !/cafy\.careers/i.test(m.href)),
      eastRiding,
    });

    await pdf.destroy();
  }

  console.log('\nResource PDF link check (same logic as the Resources viewer)\n');
  for (const row of report) {
    const ok = row.missing.length === 0;
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${row.file}`);
    console.log(`       directory URLs clickable: ${row.directoryLinks}`);
    if (row.eastRiding) console.log(`       East Riding: ${row.eastRiding}`);
    for (const m of row.missing) {
      console.log(`       MISSING p${m.page}: ${m.href}  (${m.note})`);
    }
  }

  const council = report.find((r) => /Council/i.test(r.file));
  if (council && !council.eastRiding) {
    console.log('\nFAIL  East Riding URL was not reconstructed as clickable');
    failed += 1;
  }

  console.log(
    failed === 0
      ? '\nAll directory URLs are clickable.\n'
      : `\n${failed} file(s) have unclickable URLs.\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
