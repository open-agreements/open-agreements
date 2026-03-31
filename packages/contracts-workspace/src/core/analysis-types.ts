export const DOCUMENT_TYPES = [
  'nda', 'msa', 'sow',
  'employment-agreement', 'consulting-agreement',
  'saas-agreement', 'license-agreement',
  'ip-assignment', 'stock-purchase-agreement', 'safe',
  'lpa', 'ppm', 'subscription-agreement',
  'amendment', 'addendum',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentClassification {
  document_type: DocumentType | null;
  raw_type?: string;
  confidence: 'high' | 'medium' | 'low';
  parties: string[];
  effective_date?: string;
  expiration_date?: string;
  governing_law?: string;
  summary: string;
}

export interface ClauseExtraction {
  clause: string;
  found: boolean;
  text?: string;
  section_reference?: string;
  notes?: string;
}

export interface DocumentAnalysis {
  schema_version: 1;
  document_path: string;
  content_hash: string;
  indexed_at: string;
  indexed_by: string;
  classification?: DocumentClassification;
  extractions: ClauseExtraction[];
}
