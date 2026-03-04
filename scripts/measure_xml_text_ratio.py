#!/usr/bin/env python3
"""Measure the XML-to-text size ratio of .docx templates.

Usage (from repo root):
    python scripts/measure_xml_text_ratio.py

Measures word/document.xml against stripped text content for each
.docx template in content/templates/. Useful for understanding how
much overhead raw XML adds vs. the actual text an AI agent needs to
read.
"""

import glob
import os
import re
import zipfile


def measure_docx(path):
    with zipfile.ZipFile(path) as z:
        xml_total = sum(i.file_size for i in z.infolist())
        doc_xml = z.read("word/document.xml")
        text = re.sub(r"<[^>]+>", "", doc_xml.decode("utf-8", errors="replace"))
        text = re.sub(r"\s+", " ", text).strip()
        return xml_total, len(doc_xml), len(text)


def main():
    files = sorted(glob.glob("content/templates/*/template.docx"))
    if not files:
        print("No templates found. Run from the repo root.")
        return

    print(f"{'Template':<55} {'doc.xml':>10} {'Text':>8} {'Ratio':>8}")
    print("-" * 85)

    ratios = []
    for f in files:
        name = os.path.basename(os.path.dirname(f))
        xml_total, doc_size, text_size = measure_docx(f)
        if text_size == 0:
            continue
        ratio = doc_size / text_size
        ratios.append(ratio)
        print(f"{name:<55} {doc_size:>10,} {text_size:>8,} {ratio:>7.1f}x")

    ratios.sort()
    n = len(ratios)
    median = (
        (ratios[n // 2 - 1] + ratios[n // 2]) / 2 if n % 2 == 0 else ratios[n // 2]
    )
    print("-" * 85)
    print(f"{'MEDIAN':<55} {'':>10} {'':>8} {median:>7.1f}x")
    print(f"\n{n} templates measured.")


if __name__ == "__main__":
    main()
