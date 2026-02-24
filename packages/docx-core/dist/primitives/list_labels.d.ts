export declare enum LabelType {
    LETTER = "letter",
    ROMAN = "roman",
    NUMBER = "number",
    SECTION = "section",
    ARTICLE = "article",
    NUMBERED_HEADING = "numbered_heading"
}
export type ListLabelResult = {
    label: string | null;
    label_type: LabelType | null;
    match_end: number;
};
export declare function extractListLabel(text: string): ListLabelResult;
export declare function stripListLabel(text: string): {
    stripped_text: string;
    result: ListLabelResult;
};
//# sourceMappingURL=list_labels.d.ts.map