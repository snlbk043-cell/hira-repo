import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from 'docx';
import type { ComputedKpi, DepartmentSummary, PillarSummary } from './calc';
import type { Insight } from './narrative';
import type { AppState, Filters } from '../types';

const BRAND_PRIMARY = '0F4C81';
const BRAND_ACCENT = 'D71920';
const INK = '1F2937';
const MUTED = '64748B';

const TONE_HEX: Record<Insight['tone'], string> = {
  positive: '0CA30C',
  risk: 'D03B3B',
  warning: 'EC835A',
  neutral: '0F4C81',
};

function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: BRAND_PRIMARY },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })] })],
  });
}
function cell(text: string, opts: { bold?: boolean; color?: string } = {}): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color ?? INK, size: 18 })] })],
  });
}

function table(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'D8E1EB' },
    },
    rows: [
      new TableRow({ children: headers.map(headerCell), tableHeader: true }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_ACCENT, space: 4 } },
    children: [new TextRun({ text, bold: true, color: BRAND_PRIMARY, size: 28 })],
  });
}

interface DocxParams {
  state: AppState;
  filters: Filters;
  scorecard: {
    mtdPlantScore: number | null;
    selectedDayScore: number | null;
    dataCompletion: number | null;
    kpisInScope: number;
    statusCounts: Record<string, number>;
    openActions: number;
    overdueActions: number;
  };
  deptSummaries: DepartmentSummary[];
  pillarSums: PillarSummary[];
  topExceptions: ComputedKpi[];
  insights: Insight[];
  reviewedBy?: string;
  designation?: string;
  reviewDate?: string | null;
  comments?: string;
  decision?: string;
}

export async function exportLeadershipDocx(params: DocxParams) {
  const { state, filters, scorecard, deptSummaries, pillarSums, topExceptions, insights } = params;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: state.meta.plantName, size: 22, color: MUTED })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'Factory Daily Management System — Leadership Review',
                bold: true,
                size: 40,
                color: BRAND_PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND_ACCENT, space: 8 } },
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `${filters.month} ${filters.year}  ·  Selected Day ${filters.day}  ·  Department: ${filters.department}`,
                size: 20,
                color: MUTED,
              }),
            ],
          }),

          heading('Executive Scorecard'),
          table(
            ['Metric', 'Value'],
            [
              ['MTD Plant Score', pct(scorecard.mtdPlantScore)],
              [`Day ${filters.day} Score`, pct(scorecard.selectedDayScore)],
              ['Data Completion', pct(scorecard.dataCompletion)],
              ['KPIs in Scope', String(scorecard.kpisInScope)],
              ['Achieved', String(scorecard.statusCounts.Achieved ?? 0)],
              ['Watch', String(scorecard.statusCounts.Watch ?? 0)],
              ['Action Needed', String(scorecard.statusCounts['Action Needed'] ?? 0)],
              ['Support Required', String(scorecard.statusCounts['Support Required'] ?? 0)],
              ['Open Actions', String(scorecard.openActions)],
              ['Overdue Actions', String(scorecard.overdueActions)],
            ],
          ),

          heading('Review Narrative'),
          ...insights.map(
            (insight) =>
              new Paragraph({
                spacing: { after: 140 },
                border: { left: { style: BorderStyle.SINGLE, size: 24, color: TONE_HEX[insight.tone], space: 8 } },
                indent: { left: 120 },
                children: [new TextRun({ text: insight.text, size: 20, color: INK })],
              }),
          ),

          heading('Department Performance Summary'),
          table(
            ['Department', 'KPIs', 'MTD Score', 'Completion', 'Achieved', 'Open Actions'],
            deptSummaries.map((d) => [
              d.department,
              String(d.kpis),
              pct(d.score),
              pct(d.completion),
              String(d.achieved),
              String(d.openActions),
            ]),
          ),

          heading('PQSDC Pillar Summary'),
          table(
            ['Pillar', 'KPIs', 'MTD Pace Score', 'Attention'],
            pillarSums.map((p) => [p.pillar, String(p.kpis), pct(p.score), String(p.attention)]),
          ),

          heading('Top Exceptions For Leadership Attention'),
          table(
            ['KPI', 'Department', 'MTD Pace', 'Status', 'Challenge / Reason', 'Recovery Plan'],
            topExceptions
              .slice(0, 10)
              .map((k) => [k.def.name, k.def.department, pct(k.mtdPaceScore), k.status, k.rec.challengeReason || '—', k.rec.recoveryPlan || '—']),
          ),

          heading('Leadership Sign-off'),
          table(
            ['Field', 'Value'],
            [
              ['Reviewed By', params.reviewedBy || '—'],
              ['Designation', params.designation || '—'],
              ['Review Date', params.reviewDate ? new Date(params.reviewDate).toLocaleDateString('en-IN') : '—'],
              ['Decision', params.decision || '—'],
              ['Comments', params.comments || '—'],
            ],
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${state.meta.companyName}-DMS-Leadership-Review-${filters.month}-${filters.year}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
