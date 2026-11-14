import { jsPDF } from 'jspdf';
import type { CareerRecommendation } from '../services/careerAnalysisService';

const MARGIN = 14;
const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const STATUS_LABELS: Record<string, string> = {
    open_to_new_applicants: 'Open to new sponsorship applicants',
    legacy_only_existing_visa_holders: 'Existing visa-holders only. Not open to new applicants',
    not_eligible: 'Not eligible for UK sponsorship',
};

export interface CareerReportMeta {
    resumeName?: string;
}

interface ReportPosition {
    index?: number;
    count?: number;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

function drawSectionHeading(doc: jsPDF, y: number, text: string): number {
    y = ensureSpace(doc, y, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(text.toUpperCase(), MARGIN, y);
    doc.setTextColor(30, 41, 59);
    return y + 6;
}

function drawParagraph(doc: jsPDF, y: number, text: string, opts: { fontSize?: number; bold?: boolean } = {}): number {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.fontSize ?? 9.5);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    for (const line of lines) {
        y = ensureSpace(doc, y, 5.5);
        doc.text(line, MARGIN, y);
        y += 5.2;
    }
    return y + 1.5;
}

function drawBulletList(doc: jsPDF, y: number, items: string[], emptyText: string): number {
    if (items.length === 0) {
        return drawParagraph(doc, y, emptyText);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    for (const item of items) {
        const lines = doc.splitTextToSize(`•  ${item}`, CONTENT_WIDTH - 2) as string[];
        for (const line of lines) {
            y = ensureSpace(doc, y, 5.5);
            doc.text(line, MARGIN, y);
            y += 5.2;
        }
    }
    return y + 1.5;
}

function formatRate(label: string, rate?: { annual: number | null; hourly: number | null } | null): string | null {
    if (!rate || rate.annual === null) return null;
    const hourly = rate.hourly !== null ? ` (£${rate.hourly.toFixed(2)}/hr)` : '';
    return `${label}: £${rate.annual.toLocaleString()}/yr${hourly}`;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'career_report';
}

// Draws one recommendation's report onto the current page of `doc`, starting at the top
// margin. Callers are responsible for calling doc.addPage() first if this report should
// not share a page with whatever was drawn before it.
function drawCareerReportContent(doc: jsPDF, rec: CareerRecommendation, meta: CareerReportMeta, position: ReportPosition = {}): void {
    let y = MARGIN;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('CAFY: UK CAREER MATCH REPORT', MARGIN, y);
    const headerRight = position.index && position.count
        ? `Report ${position.index} of ${position.count}   •   ${new Date().toLocaleDateString('en-GB')}`
        : new Date().toLocaleDateString('en-GB');
    doc.text(headerRight, PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 8;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(rec.officialTitle, CONTENT_WIDTH) as string[];
    for (const line of titleLines) {
        y = ensureSpace(doc, y, 8);
        doc.text(line, MARGIN, y);
        y += 7.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`SOC Code: ${rec.socCode}   •   Category: ${rec.category}`, MARGIN, y);
    y += 8;

    if (rec.socData) {
        const statusLabel = STATUS_LABELS[rec.socData.sponsorship.applicantStatus] || 'Sponsorship status unrated';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        y = ensureSpace(doc, y, 7);
        doc.text(`Sponsorship: ${statusLabel}`, MARGIN, y);
        y += 6;
        if (rec.socData.skillLevel) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(71, 85, 105);
            y = ensureSpace(doc, y, 6);
            doc.text(`Skill level: ${rec.socData.skillLevel}`, MARGIN, y);
            y += 7;
        }
    }
    doc.setTextColor(30, 41, 59);

    if (meta.resumeName) {
        y = drawParagraph(doc, y, `Based on resume: ${meta.resumeName}`, { fontSize: 8.5 });
    }

    y = drawSectionHeading(doc, y, 'Fit Justification');
    y = drawParagraph(doc, y, rec.reason || 'Not provided.');

    if (rec.matchedSubRoles && rec.matchedSubRoles.length > 0) {
        y = drawSectionHeading(doc, y, 'Personalized Matches');
        y = drawBulletList(doc, y, rec.matchedSubRoles, 'None identified.');
    }

    y = drawSectionHeading(doc, y, 'Attributes Present in Resume');
    y = drawBulletList(doc, y, rec.availableInResume, 'No direct matches explicitly identified in resume.');

    y = drawSectionHeading(doc, y, 'Actionable Skills Gap Roadmap');
    y = drawBulletList(doc, y, rec.neededOrSuggested, 'You satisfy all recommended criteria for this occupation.');

    if (rec.socData) {
        y = drawSectionHeading(doc, y, 'Sponsorship & Salary: UK Government Data');
        const { salary, sponsorship } = rec.socData;

        if (salary.type === 'going_rate') {
            if (salary.median) {
                y = drawParagraph(doc, y, `Median-based going rate (${salary.median.source})`, { bold: true, fontSize: 9.5 });
                const rows = [
                    formatRate('Full rate', salary.median.rate100),
                    formatRate('90%', salary.median.rate90),
                    formatRate('80%', salary.median.rate80),
                    formatRate('70%', salary.median.rate70),
                ].filter((r): r is string => r !== null);
                y = drawBulletList(doc, y, rows, 'Not published.');
            }
            if (salary.percentile25) {
                y = drawParagraph(doc, y, `25th-percentile going rate (${salary.percentile25.source})`, { bold: true, fontSize: 9.5 });
                const rows = [
                    formatRate('Full rate', salary.percentile25.rate100),
                    formatRate('90%', salary.percentile25.rate90),
                    formatRate('80%', salary.percentile25.rate80),
                    formatRate('70%', salary.percentile25.rate70),
                ].filter((r): r is string => r !== null);
                y = drawBulletList(doc, y, rows, 'Not published.');
            }
            if (!salary.median && !salary.percentile25) {
                y = drawParagraph(doc, y, 'No going-rate salary data published for this occupation.');
            }
        } else if (salary.type === 'national_pay_scale' && salary.nationalPayScale) {
            y = drawParagraph(doc, y, 'Pay Scale: NHS / National Pay Scale', { bold: true, fontSize: 9.5 });
            for (const [nation, entry] of Object.entries(salary.nationalPayScale.byNation)) {
                y = drawParagraph(doc, y, `${nation} (${entry.source}): ${entry.rawText.replace(/\|/g, ' / ')}`);
            }
        } else if (salary.type === 'not_eligible') {
            y = drawParagraph(doc, y, 'Not eligible. No UK sponsorship salary threshold published for this occupation.');
        }

        y = drawSectionHeading(doc, y, 'Visa Routes & Immigration Salary List');
        if (sponsorship.routes) {
            const routeLines = [
                `Skilled Worker: ${sponsorship.routes.skilledWorker ? 'Eligible' : 'Not eligible'}`,
                `Global Business Mobility: ${sponsorship.routes.globalBusinessMobility ? 'Eligible' : 'Not eligible'}`,
                `Scale-up: ${sponsorship.routes.scaleUp ? 'Eligible' : 'Not eligible'}`,
            ];
            y = drawBulletList(doc, y, routeLines, '');
        } else {
            y = drawParagraph(doc, y, 'No visa route applies. Not eligible for sponsorship.');
        }

        if (sponsorship.immigrationSalaryList && sponsorship.immigrationSalaryList.length > 0) {
            for (const entry of sponsorship.immigrationSalaryList) {
                const nations = Object.entries(entry.nations).filter(([, v]) => v).map(([n]) => n).join(', ') || 'none specified';
                y = drawParagraph(doc, y, `On the Immigration Salary List (${entry.criteria}). Applies in: ${nations}. Removal date: ${entry.removalDate}.`);
            }
        } else {
            y = drawParagraph(doc, y, 'Not on the Immigration Salary List.');
        }

        if (sponsorship.phdEligible !== null) {
            y = drawParagraph(doc, y, sponsorship.phdEligible
                ? 'PhD in a STEM subject qualifies for a reduced salary threshold.'
                : 'Not PhD-eligible for a reduced salary threshold (confirmed).');
        }
    }
}

function applyFooter(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
        doc.text('Generated by CAFY from official UK SOC 2020 government data', MARGIN, PAGE_HEIGHT - 8);
    }
}

export function buildCareerReportDoc(rec: CareerRecommendation, meta: CareerReportMeta = {}): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawCareerReportContent(doc, rec, meta);
    applyFooter(doc);
    return doc;
}

// Builds a single PDF containing every recommendation's report, one after another,
// each starting on its own page.
export function buildAllCareerReportsDoc(recommendations: CareerRecommendation[], meta: CareerReportMeta = {}): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    recommendations.forEach((rec, idx) => {
        if (idx > 0) doc.addPage();
        drawCareerReportContent(doc, rec, meta, { index: idx + 1, count: recommendations.length });
    });
    applyFooter(doc);
    return doc;
}

export function downloadCareerReport(rec: CareerRecommendation, meta: CareerReportMeta = {}): void {
    const doc = buildCareerReportDoc(rec, meta);
    doc.save(`${sanitizeFilename(rec.officialTitle)}_${rec.socCode}_report.pdf`);
}

export function downloadAllCareerReports(recommendations: CareerRecommendation[], meta: CareerReportMeta = {}): void {
    const doc = buildAllCareerReportsDoc(recommendations, meta);
    doc.save(`career_match_reports_${new Date().toISOString().slice(0, 10)}.pdf`);
}
