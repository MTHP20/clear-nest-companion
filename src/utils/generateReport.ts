import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CapturedItem, ActionItem } from '@/contexts/SessionContext';

// ─── Brand ────────────────────────────────────────────────────────────────────
const BLUE   = [74, 127, 165] as const;   // #4A7FA5
const DARK   = [26, 26, 46]   as const;   // #1A1A2E
const MUTED  = [107, 114, 128] as const;  // #6B7280
const BORDER = [220, 220, 220] as const;
const GREEN  = [52, 168, 83]  as const;
const AMBER  = [245, 124, 0]  as const;
const RED    = [229, 57, 53]  as const;
const BG     = [253, 250, 245] as const;  // warm paper tone

const CATEGORY_LABELS: Record<string, string> = {
  bank_accounts:      'Banking & Accounts',
  financial_accounts: 'Pensions & Investments',
  property:           'Property',
  documents:          'Documents & Legal',
  key_contacts:       'Key Contacts',
  care_wishes:        'Care Wishes',
  general:            'General Notes',
};

const CATEGORY_ORDER = [
  'bank_accounts',
  'financial_accounts',
  'property',
  'documents',
  'key_contacts',
  'care_wishes',
  'general',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rgb(doc: jsPDF, r: number, g: number, b: number) {
  doc.setTextColor(r, g, b);
}

function bar(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  r: number, g: number, b: number,
) {
  doc.setFillColor(r, g, b);
  doc.rect(x, y, w, h, 'F');
}

function readinessScore(items: CapturedItem[]): number {
  const cats = new Set(items.map(i => i.category));
  const covered = [
    'bank_accounts', 'financial_accounts', 'property',
    'documents', 'key_contacts', 'care_wishes',
  ].filter(c => cats.has(c));
  return Math.round((covered.length / 6) * 100);
}

function progressBar(doc: jsPDF, x: number, y: number, w: number, pct: number) {
  // Track
  doc.setFillColor(230, 235, 240);
  doc.roundedRect(x, y, w, 6, 3, 3, 'F');
  // Fill
  if (pct > 0) {
    const fillW = Math.max(6, (pct / 100) * w);
    doc.setFillColor(...BLUE);
    doc.roundedRect(x, y, fillW, 6, 3, 3, 'F');
  }
}

// ─── Header printed on every page ────────────────────────────────────────────
function printHeader(doc: jsPDF, parentName: string, childName: string) {
  const W = doc.internal.pageSize.width;
  bar(doc, 0, 0, W, 14, ...BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  rgb(doc, 255, 255, 255);
  doc.text('ClearNest', 14, 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rgb(doc, 200, 220, 240);
  doc.text(`${parentName}'s Family Affairs Summary`, 14, 14 + 5); // placed below, see below
  // right side — page num added later
  doc.setFontSize(8);
  doc.text(`${childName} reviewing ${parentName}`, W - 14, 9.5, { align: 'right' });
}

function printFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  bar(doc, 0, H - 10, W, 10, 240, 243, 247);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  rgb(doc, ...MUTED);
  doc.text(
    'This document is private. Downloaded to your device only. Nothing sent to ClearNest servers.',
    14, H - 3.5,
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, W - 14, H - 3.5, { align: 'right' });
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateFamilyReportPDF(
  capturedItems: CapturedItem[],
  actionItems: ActionItem[],
  userNotes: Record<string, string>,
  parentName: string,
  childName: string,
  sessionsCompleted: number,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.width;   // 210mm
  const score = readinessScore(capturedItems);
  const activeActions = actionItems.filter(a => a.status !== 'done');

  // ── Cover page ───────────────────────────────────────────────────────────
  // Header stripe
  bar(doc, 0, 0, W, 52, ...BLUE);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  rgb(doc, 255, 255, 255);
  doc.text('ClearNest', 20, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  rgb(doc, 200, 220, 240);
  doc.text('Family Affairs Summary', 20, 31);

  doc.setFontSize(10);
  doc.text(`Prepared by ${childName} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, 40);
  doc.text(`Reviewing ${parentName}`, 20, 47);

  // Readiness score card
  const cardY = 62;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, cardY, W - 28, 38, 4, 4, 'F');
  doc.setDrawColor(...BORDER);
  doc.roundedRect(14, cardY, W - 28, 38, 4, 4, 'S');

  // Score circle (drawn with rounded rect approximation)
  const cx = 44, cy = cardY + 19;
  doc.setFillColor(...BLUE);
  doc.circle(cx, cy, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  rgb(doc, 255, 255, 255);
  doc.text(`${score}%`, cx, cy + 3, { align: 'center' });

  // Score label + bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  rgb(doc, ...DARK);
  doc.text('Family Readiness Score', 66, cardY + 11);
  progressBar(doc, 66, cardY + 15, 120, score);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rgb(doc, ...MUTED);
  doc.text(`${capturedItems.length} items captured across ${sessionsCompleted} session${sessionsCompleted !== 1 ? 's' : ''}`, 66, cardY + 26);
  doc.text(`${activeActions.length} action${activeActions.length !== 1 ? 's' : ''} require attention`, 66, cardY + 32);

  // Category coverage chips
  let chipX = 14;
  const chipY = cardY + 45;
  CATEGORY_ORDER.forEach(cat => {
    const label = CATEGORY_LABELS[cat];
    const hasCat = capturedItems.some(i => i.category === cat);
    const w = doc.getTextWidth(label) + 8;
    doc.setFillColor(hasCat ? 74 : 230, hasCat ? 127 : 235, hasCat ? 165 : 240);
    doc.roundedRect(chipX, chipY - 4, w, 6, 2, 2, 'F');
    doc.setFontSize(7);
    rgb(doc, hasCat ? 255 : 150, hasCat ? 255 : 155, hasCat ? 255 : 160);
    doc.text(label, chipX + 4, chipY);
    chipX += w + 3;
    if (chipX > W - 30) { chipX = 14; } // wrap if needed
  });

  // How this report was created
  const infoY = cardY + 60;
  bar(doc, 14, infoY, W - 28, 0.4, ...BORDER);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rgb(doc, ...MUTED);
  const intro = `This document was compiled from conversations between Clara (a voice companion created by ClearNest) and ${parentName}. ` +
    `Information was captured in real-time during ${sessionsCompleted} voice session${sessionsCompleted !== 1 ? 's' : ''} ` +
    `and reviewed by ${childName}. This report is intended to help family members and professional advisers understand ${parentName}'s affairs.`;
  const introLines = doc.splitTextToSize(intro, W - 28);
  doc.text(introLines, 14, infoY + 8);

  // ── Category sections ─────────────────────────────────────────────────────
  let y = infoY + 8 + introLines.length * 4 + 10;

  const itemsByCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = capturedItems.filter(i => i.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, CapturedItem[]>);

  for (const [cat, items] of Object.entries(itemsByCategory)) {
    // Section needs ~20mm minimum; if too little space, new page
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    // Section heading
    bar(doc, 14, y, W - 28, 0.5, ...BLUE);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    rgb(doc, ...BLUE);
    doc.text(CATEGORY_LABELS[cat] ?? cat, 14, y + 4);
    y += 9;

    // Table rows
    const rows = items.map(item => {
      const note = userNotes[item.id];
      const content = note ? `${item.content}\n${childName}'s note: ${note}` : item.content;
      const conf = item.confidence === 'clear' ? 'Clear' : 'Follow-up';
      const verification = item.verificationStatus === 'verified'
        ? '✓ Verified'
        : item.verificationStatus === 'disputed'
        ? '✗ Disputed'
        : '—';
      return [content, conf, verification];
    });

    autoTable(doc, {
      startY: y,
      head: [['Information', 'Confidence', 'Verified']],
      body: rows,
      theme: 'plain',
      headStyles: {
        fillColor: [240, 245, 250],
        textColor: [...DARK],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8.5, textColor: [...DARK] },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      styles: { lineColor: [...BORDER], lineWidth: 0.2, cellPadding: 3 },
      didDrawCell: (data) => {
        // Colour-code confidence and verification cells
        if (data.section === 'body' && data.column.index === 1) {
          const v = data.cell.raw as string;
          if (v === 'Clear') doc.setTextColor(...GREEN);
          else doc.setTextColor(...AMBER);
        }
        if (data.section === 'body' && data.column.index === 2) {
          const v = data.cell.raw as string;
          if (v.startsWith('✓')) doc.setTextColor(...GREEN);
          else if (v.startsWith('✗')) doc.setTextColor(...RED);
        }
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Action items ──────────────────────────────────────────────────────────
  if (activeActions.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }

    bar(doc, 14, y, W - 28, 0.5, ...RED);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    rgb(doc, ...RED);
    doc.text('Urgent Actions Required', 14, y + 4);
    y += 9;

    const actionRows = activeActions.map(a => [
      a.severity === 'red' ? '🔴 Critical' : '🟡 Important',
      a.title,
      a.description,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Priority', 'Action', 'Detail']],
      body: actionRows,
      theme: 'plain',
      headStyles: {
        fillColor: [255, 243, 243],
        textColor: [...RED],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8.5, textColor: [...DARK] },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 96 },
      },
      margin: { left: 14, right: 14 },
      styles: { lineColor: [...BORDER], lineWidth: 0.2, cellPadding: 3 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (capturedItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    rgb(doc, ...MUTED);
    doc.text('No information has been captured yet.', W / 2, 140, { align: 'center' });
    doc.setFontSize(9);
    doc.text('Start a conversation with Clara to begin building this report.', W / 2, 150, { align: 'center' });
  }

  // ── Add header/footer to every page ──────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) printHeader(doc, parentName, childName);
    printFooter(doc, i, totalPages);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `clearnest-${parentName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
