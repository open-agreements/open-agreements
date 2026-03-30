export type DocumentType =
  | 'nda'
  | 'msa'
  | 'sow'
  | 'employment-agreement'
  | 'consulting-agreement'
  | 'saas-agreement'
  | 'license-agreement'
  | 'ip-assignment'
  | 'stock-purchase-agreement'
  | 'safe'
  | 'amendment'
  | 'addendum'
  | 'other';

export interface DocumentClassification {
  document_type: DocumentType;
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
  document_id: string;
  document_path: string;
  content_hash: string;
  analyzed_at: string;
  analyzed_by: string;
  classification?: DocumentClassification;
  extractions: ClauseExtraction[];
}
