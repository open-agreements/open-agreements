import { LabelType } from './list_labels.js';
import { type ParagraphAlignment, type RunFormatting } from './styles.js';
import type { RelsMap } from './relationships.js';
export type HeaderFormatting = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
};
export type ListMetadata = {
    list_level: number;
    label_type: LabelType | null;
    label_string: string;
    header_text: string | null;
    header_style: string | null;
    header_formatting: HeaderFormatting | null;
    is_auto_numbered: boolean;
};
export type FormattingFingerprint = {
    list_level: number;
    left_indent_pt: number;
    first_line_indent_pt: number;
    style_name: string;
    alignment: ParagraphAlignment;
};
export type DocumentStyleInfo = {
    style_id: string;
    display_name: string;
    fingerprint: FormattingFingerprint;
    example_node_id: string;
    example_text: string;
    count: number;
    dominant_alignment: ParagraphAlignment;
};
export type DocumentStyles = {
    styles: Map<string, DocumentStyleInfo>;
    fingerprint_to_style: Map<string, string>;
};
export type DocumentViewNode = {
    id: string;
    list_label: string;
    header: string;
    style: string;
    text: string;
    clean_text: string;
    tagged_text: string;
    list_metadata: ListMetadata;
    style_fingerprint: FormattingFingerprint;
    paragraph_style_id: string | null;
    paragraph_style_name: string;
    paragraph_alignment: ParagraphAlignment;
    paragraph_indents_pt: {
        left: number;
        first_line: number;
    };
    numbering: {
        num_id: string | null;
        ilvl: number | null;
        is_auto_numbered: boolean;
    };
    header_formatting: HeaderFormatting | null;
    body_run_formatting: RunFormatting | null;
};
export declare function discoverStyles(nodes: DocumentViewNode[]): DocumentStyles;
export declare function renderToon(nodes: DocumentViewNode[]): string;
export type BuildDocumentViewOptions = {
    include_semantic_tags?: boolean;
};
export declare function buildDocumentView(params: {
    documentXml: Document;
    stylesXml: Document | null;
    numberingXml: Document | null;
    opts?: BuildDocumentViewOptions;
}): {
    nodes: DocumentViewNode[];
    styles: DocumentStyles;
};
export declare function buildNodesForDocumentView(params: {
    paragraphs: Array<{
        id: string;
        p: Element;
    }>;
    stylesXml: Document | null;
    numberingXml: Document | null;
    include_semantic_tags?: boolean;
    show_formatting?: boolean;
    relsMap?: RelsMap;
    documentXml?: Document;
    footnotesXml?: Document | null;
}): {
    nodes: DocumentViewNode[];
    styles: DocumentStyles;
};
//# sourceMappingURL=document_view.d.ts.map