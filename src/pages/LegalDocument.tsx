import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';

export type LegalDocumentProps = {
  /** Public URL of the markdown file (served from /public) */
  markdownPath: string;
  pageTitle: string;
};

export function LegalDocument({ markdownPath, pageTitle }: LegalDocumentProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(false);
    fetch(markdownPath)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [markdownPath]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${pageTitle} · ClearNest`;
    return () => {
      document.title = prev;
    };
  }, [pageTitle]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
        {error && (
          <p className="font-body text-destructive" role="alert">
            We couldn&apos;t load this document. Please try again or email hello@clearnest.co.uk.
          </p>
        )}
        {!error && content === null && <p className="font-body text-muted-foreground">Loading…</p>}
        {content !== null && (
          <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-display prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}
