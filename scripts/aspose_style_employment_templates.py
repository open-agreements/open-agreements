#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from pathlib import Path

import aspose.words as aw


ROOT = Path(__file__).resolve().parents[1]
JUNIOR_ROOT = Path("/Users/stevenobiajulu/Projects/junior-AI-email-bot")

TARGETS = [
    ROOT / "templates/openagreements-employment-offer-letter/template.docx",
    ROOT / "templates/openagreements-employee-ip-inventions-assignment/template.docx",
    ROOT / "templates/openagreements-employment-confidentiality-acknowledgement/template.docx",
]

CLAUSE_HEADING_RE = re.compile(r"^\d+\.\s.+\.$")


def _clean_text(paragraph: aw.Paragraph) -> str:
    return (
        paragraph.to_string(aw.SaveFormat.TEXT)
        .replace("\r", "")
        .replace("\x07", "")
        .strip()
    )


def try_apply_license() -> None:
    candidates = [
        os.environ.get("JUNIOR_ASPOSE_LICENSE_PATH"),
        os.environ.get("ASPOSE_LICENSE_PATH"),
        str(JUNIOR_ROOT / "licenses/Aspose.Words.Python.NET.lic"),
    ]

    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate)
        if not path.exists():
            continue
        license_obj = aw.License()
        license_obj.set_license(str(path))
        print(f"[ok] Aspose license applied from {path}")
        return

    print("[warn] Aspose license not found; running in evaluation mode", file=sys.stderr)


def style_tables(doc: aw.Document) -> None:
    tables = doc.get_child_nodes(aw.NodeType.TABLE, True)
    for t_idx in range(tables.count):
        table = tables[t_idx].as_table()
        for row_idx in range(table.rows.count):
            row = table.rows[row_idx]
            row.row_format.height_rule = aw.HeightRule.AT_LEAST
            row.row_format.height = 34
            for cell_idx in range(row.cells.count):
                cell = row.cells[cell_idx]
                cell.cell_format.top_padding = 7
                cell.cell_format.bottom_padding = 7
                cell.cell_format.left_padding = 8
                cell.cell_format.right_padding = 8
                for p_idx in range(cell.paragraphs.count):
                    para = cell.paragraphs[p_idx]
                    pf = para.paragraph_format
                    pf.space_before = 0
                    pf.space_after = 10


def style_paragraphs(doc: aw.Document) -> None:
    paragraphs = doc.get_child_nodes(aw.NodeType.PARAGRAPH, True)
    for idx in range(paragraphs.count):
        para = paragraphs[idx].as_paragraph()
        text = _clean_text(para)
        if not text:
            continue

        in_table = para.get_ancestor(aw.NodeType.CELL) is not None
        pf = para.paragraph_format

        if text in {"Standard Terms", "Signatures"}:
            pf.space_before = 22
            pf.space_after = 14
            continue

        if CLAUSE_HEADING_RE.match(text):
            pf.space_before = 16
            pf.space_after = 6
            continue

        if text.startswith("OpenAgreements Employment Terms v1.0"):
            pf.space_before = 4
            pf.space_after = 10
            continue

        if text.startswith("Cover Terms:"):
            pf.space_before = 0
            pf.space_after = 14
            continue

        if text in {"Company", "Employee"}:
            pf.space_before = 10
            pf.space_after = 8
            continue

        if text.startswith("Signature:") or text.startswith("Name:") or text.startswith("Title:"):
            pf.space_before = 2
            pf.space_after = 10
            continue

        if not in_table:
            pf.space_before = 0
            pf.space_after = 14


def remove_blank_spacer_paragraphs(doc: aw.Document) -> None:
    to_remove: list[aw.Paragraph] = []
    paragraphs = doc.get_child_nodes(aw.NodeType.PARAGRAPH, True)
    for idx in range(paragraphs.count):
        para = paragraphs[idx].as_paragraph()
        text = _clean_text(para)
        if text:
            continue
        if para.get_ancestor(aw.NodeType.CELL) is None:
            to_remove.append(para)

    for para in to_remove:
        para.remove()


def process(path: Path) -> None:
    doc = aw.Document(str(path))
    remove_blank_spacer_paragraphs(doc)
    style_tables(doc)
    style_paragraphs(doc)
    doc.save(str(path))
    print(f"[ok] styled {path}")


def main() -> None:
    try_apply_license()
    for path in TARGETS:
        process(path)


if __name__ == "__main__":
    main()
