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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <ClearNestLogo href="/" variant="small" className="min-w-0" />
          <Link
            to="/"
            className="shrink-0 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 pb-20">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">Legal</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl mb-3">
          {parsed.heroTitle}
        </h1>
        {parsed.lastUpdated && (
          <p className="font-body text-sm text-muted-foreground mb-10">Last updated: {parsed.lastUpdated}</p>
        )}
        {!parsed.lastUpdated && <div className="mb-10" />}
        <article className="legal-doc-body prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-display prose-headings:font-semibold prose-h2:text-lg prose-h2:uppercase prose-h2:tracking-wide prose-p:font-body prose-li:font-body prose-a:text-primary prose-strong:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
