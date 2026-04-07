import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { type LegalDocId, LEGAL_MARKDOWN } from '@/legal/legalMarkdown';

const PAGE_TITLES: Record<LegalDocId, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  safeguarding: 'Safeguarding Policy',
};

export type LegalDocumentProps = {
  doc: LegalDocId;
};

function parseLegalMarkdown(raw: string, fallbackTitle: string) {
  const lines = raw.split('\n');
  let heroTitle = fallbackTitle;
  let startIdx = 0;
  const first = lines[0]?.trim();
  if (first?.startsWith('# ')) {
    heroTitle = first.slice(2).trim();
    startIdx = 1;
    while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
  }
  let body = lines.slice(startIdx).join('\n');
  const lastUpdated =
    raw.match(/(?:\*\*)?Last updated(?:\*\*)?:\s*([^\n*]+)/i)?.[1]?.trim() ?? null;
  if (lastUpdated) {
    body = body.replace(/\s*(?:\*\*)?Last updated(?:\*\*)?:\s*[^\n]+/i, '').replace(/\n{3,}/g, '\n\n');
  }
  return { heroTitle, lastUpdated, body: body.trimStart() };
}

export function LegalDocument({ doc }: LegalDocumentProps) {
  const pageTitle = PAGE_TITLES[doc];
  const rawContent = LEGAL_MARKDOWN[doc];

  const parsed = useMemo(() => parseLegalMarkdown(rawContent, pageTitle), [rawContent, pageTitle]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${parsed.heroTitle} · ClearNest`;
    return () => {
      document.title = prev;
    };
  }, [parsed.heroTitle]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <ClearNestLogo
            href="/"
            variant="small"
            className="min-w-0 [&_span]:!text-slate-900"
          />
          <Link
            to="/"
            className="shrink-0 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 mb-3">Legal</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl mb-3">
          {parsed.heroTitle}
        </h1>
        {parsed.lastUpdated && (
          <p className="font-body text-sm text-slate-600 mb-10">Last updated: {parsed.lastUpdated}</p>
        )}
        {!parsed.lastUpdated && <div className="mb-10" />}
        <article
          className={[
            'legal-doc-body max-w-none rounded-2xl border border-slate-200/80 bg-white px-5 py-8 shadow-sm sm:px-8',
            'prose prose-slate prose-lg',
            'prose-headings:scroll-mt-20 prose-headings:font-display prose-headings:font-semibold prose-headings:text-slate-900',
            'prose-h2:text-base prose-h2:uppercase prose-h2:tracking-wide prose-h2:text-slate-800',
            'prose-p:font-body prose-p:leading-relaxed prose-p:text-slate-700',
            'prose-li:font-body prose-li:text-slate-700 prose-li:marker:text-slate-500',
            'prose-strong:text-slate-900 prose-strong:font-semibold',
            'prose-a:font-medium prose-a:text-indigo-700 prose-a:underline prose-a:decoration-indigo-400 prose-a:underline-offset-2 hover:prose-a:text-indigo-900',
            'prose-hr:border-slate-200',
            'prose-blockquote:border-l-indigo-300 prose-blockquote:text-slate-700',
            'prose-table:text-sm prose-th:text-slate-900 prose-th:bg-slate-50 prose-td:text-slate-700',
          ].join(' ')}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
