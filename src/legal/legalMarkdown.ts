import privacy from './privacy-policy.md?raw';
import terms from './terms-of-service.md?raw';
import safeguarding from './safeguarding-policy.md?raw';

export type LegalDocId = 'privacy' | 'terms' | 'safeguarding';

export const LEGAL_MARKDOWN: Record<LegalDocId, string> = {
  privacy,
  terms,
  safeguarding,
};
