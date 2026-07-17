import pptxgen from 'pptxgenjs';
import type { ComputedKpi, DepartmentSummary, PillarSummary } from './calc';
import type { AppState, Filters } from '../types';

const BRAND_PRIMARY = '0F4C81';
const BRAND_ACCENT = 'D71920';
const INK = '1F2937';
const MUTED = '64748B';

function statusHex(status: string): string {
  switch (status) {
    case 'Achieved':
      return '0CA30C';
    case 'Watch':
      return 'FAB219';
    case 'Action Needed':
      return 'EC835A';
    case 'Support Required':
      return 'D03B3B';
    default:
      return '898781';
  }
}

interface DeckParams {
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
  reviewedBy?: string;
  designation?: string;
  reviewDate?: string | null;
  comments?: string;
  decision?: string;
}

function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export async function exportLeadershipDeck(params: DeckParams) {
  const { state, filters, scorecard, deptSummaries, pillarSums, topExceptions } = params;
  const pres = new pptxgen();
  pres.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pres.layout = 'WIDE';

  const titleSlide = pres.addSlide();
  titleSlide.background = { color: BRAND_PRIMARY };
  titleSlide.addShape('rect', { x: 0, y: 7.15, w: 13.33, h: 0.35, fill: { color: BRAND_ACCENT } });
  titleSlide.addText(state.meta.plantName, {
    x: 0.7,
    y: 2.6,
    w: 12,
    h: 0.6,
    fontSize: 16,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText('Factory Daily Management System — Leadership Review', {
    x: 0.7,
    y: 3.1,
    w: 12,
    h: 1,
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(`${filters.month} ${filters.year}  ·  Selected Day ${filters.day}  ·  Department: ${filters.department}`, {
    x: 0.7,
    y: 4.0,
    w: 12,
    h: 0.5,
    fontSize: 16,
    color: 'D6E8F7',
    fontFace: 'Segoe UI',
  });

  const scoreSlide = pres.addSlide();
  addSlideHeader(pres, scoreSlide, 'Executive Scorecard');
  const statCards: { label: string; value: string; color: string }[] = [
    { label: 'MTD Plant Score', value: pct(scorecard.mtdPlantScore), color: BRAND_PRIMARY },
    { label: `Day ${filters.day} Score`, value: pct(scorecard.selectedDayScore), color: BRAND_PRIMARY },
    { label: 'Data Completion', value: pct(scorecard.dataCompletion), color: BRAND_PRIMARY },
    { label: 'KPIs in Scope', value: String(scorecard.kpisInScope), color: INK },
    { label: 'Achieved', value: String(scorecard.statusCounts.Achieved ?? 0), color: statusHex('Achieved') },
    { label: 'Watch', value: String(scorecard.statusCounts.Watch ?? 0), color: statusHex('Watch') },
    { label: 'Action Needed', value: String(scorecard.statusCounts['Action Needed'] ?? 0), color: statusHex('Action Needed') },
    { label: 'Support Required', value: String(scorecard.statusCounts['Support Required'] ?? 0), color: statusHex('Support Required') },
    { label: 'Open Actions', value: String(scorecard.openActions), color: INK },
    { label: 'Overdue Actions', value: String(scorecard.overdueActions), color: statusHex('Support Required') },
  ];
  const cardW = 2.3;
  const cardH = 1.5;
  const gap = 0.25;
  statCards.forEach((c, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = 0.5 + col * (cardW + gap);
    const y = 1.6 + row * (cardH + gap);
    scoreSlide.addShape('roundRect', { x, y, w: cardW, h: cardH, fill: { color: 'F4F7FB' }, line: { color: 'D8E1EB', width: 1 }, rectRadius: 0.08 });
    scoreSlide.addText(c.label.toUpperCase(), { x: x + 0.15, y: y + 0.12, w: cardW - 0.3, h: 0.35, fontSize: 10, color: MUTED, fontFace: 'Segoe UI' });
    scoreSlide.addText(c.value, { x: x + 0.15, y: y + 0.5, w: cardW - 0.3, h: 0.8, fontSize: 26, bold: true, color: c.color, fontFace: 'Segoe UI' });
  });

  const deptSlide = pres.addSlide();
  addSlideHeader(pres, deptSlide, 'Department Performance');
  const deptRows = [
    [
      { text: 'Department', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'KPIs', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'MTD Score', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Completion', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Achieved', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Open Actions', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
    ],
    ...deptSummaries.map((d) => [
      { text: d.department },
      { text: String(d.kpis) },
      { text: pct(d.score) },
      { text: pct(d.completion) },
      { text: String(d.achieved) },
      { text: String(d.openActions) },
    ]),
  ];
  deptSlide.addTable(deptRows as never, {
    x: 0.5,
    y: 1.6,
    w: 12.3,
    fontSize: 12,
    fontFace: 'Segoe UI',
    border: { type: 'solid', color: 'D8E1EB', pt: 0.5 },
    autoPage: false,
  });

  const pillarSlide = pres.addSlide();
  addSlideHeader(pres, pillarSlide, 'PQSDC Pillar Performance');
  const pillarRows = [
    [
      { text: 'Pillar', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'KPIs', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'MTD Pace Score', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Attention', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
    ],
    ...pillarSums.map((p) => [{ text: p.pillar }, { text: String(p.kpis) }, { text: pct(p.score) }, { text: String(p.attention) }]),
  ];
  pillarSlide.addTable(pillarRows as never, {
    x: 0.5,
    y: 1.6,
    w: 9,
    fontSize: 14,
    fontFace: 'Segoe UI',
    border: { type: 'solid', color: 'D8E1EB', pt: 0.5 },
    autoPage: false,
  });

  const excSlide = pres.addSlide();
  addSlideHeader(pres, excSlide, `Top KPI Exceptions — Day ${filters.day}`);
  const excRows = [
    [
      { text: 'KPI', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Department', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'MTD Pace', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
      { text: 'Challenge / Reason', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_PRIMARY } } },
    ],
    ...topExceptions.slice(0, 8).map((k) => [
      { text: k.def.name },
      { text: k.def.department },
      { text: pct(k.mtdPaceScore) },
      { text: k.status, options: { color: statusHex(k.status), bold: true } },
      { text: k.rec.challengeReason || '—' },
    ]),
  ];
  excSlide.addTable(excRows as never, {
    x: 0.5,
    y: 1.6,
    w: 12.3,
    fontSize: 11,
    fontFace: 'Segoe UI',
    border: { type: 'solid', color: 'D8E1EB', pt: 0.5 },
    autoPage: false,
  });

  const signSlide = pres.addSlide();
  addSlideHeader(pres, signSlide, 'Leadership Review & Sign-off');
  const signRows: [string, string][] = [
    ['Reviewed By', params.reviewedBy || '—'],
    ['Designation', params.designation || '—'],
    ['Review Date', params.reviewDate ? new Date(params.reviewDate).toLocaleDateString('en-IN') : '—'],
    ['Decision', params.decision || '—'],
  ];
  signRows.forEach(([label, value], i) => {
    const y = 1.7 + i * 0.6;
    signSlide.addText(label, { x: 0.5, y, w: 2.5, h: 0.5, fontSize: 13, bold: true, color: MUTED, fontFace: 'Segoe UI' });
    signSlide.addText(value, { x: 3.1, y, w: 8, h: 0.5, fontSize: 13, color: INK, fontFace: 'Segoe UI' });
  });
  signSlide.addText('Comments', { x: 0.5, y: 4.3, w: 2.5, h: 0.4, fontSize: 13, bold: true, color: MUTED, fontFace: 'Segoe UI' });
  signSlide.addText(params.comments || '—', { x: 0.5, y: 4.7, w: 11.5, h: 2, fontSize: 12, color: INK, fontFace: 'Segoe UI' });

  const fileName = `${state.meta.companyName}-DMS-Leadership-Review-${filters.month}-${filters.year}.pptx`;
  await pres.writeFile({ fileName });
}

function addSlideHeader(_pres: pptxgen, slide: pptxgen.Slide, title: string) {
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: BRAND_PRIMARY } });
  slide.addShape('rect', { x: 0, y: 1.1, w: 13.33, h: 0.05, fill: { color: BRAND_ACCENT } });
  slide.addText(title, { x: 0.5, y: 0.2, w: 12, h: 0.7, fontSize: 24, bold: true, color: 'FFFFFF', fontFace: 'Segoe UI' });
}
