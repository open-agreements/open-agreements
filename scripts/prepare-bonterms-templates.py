#!/usr/bin/env python3
"""
One-time script to convert official Bonterms cover page DOCX files into
open-agreements templates by editing the OOXML directly.

Sources (CC0 1.0 licensed):
  - nda-cover-page.docx  from github.com/Bonterms/Mutual-NDA
  - psa-cover-page.docx  from github.com/Bonterms/Professional-Services-Agreement

Usage:
    uv run python scripts/prepare-bonterms-templates.py

Requires: no external dependencies (stdlib only: zipfile, xml.etree)
"""

import copy
import sys
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET

# ── Namespace map for OOXML ──────────────────────────────────────────────────

NSMAP = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

for prefix, uri in NSMAP.items():
    ET.register_namespace(prefix, uri)

# Also register common namespaces that appear in DOCX but we don't query
_EXTRA_NS = {
    "wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
    "cx": "http://schemas.microsoft.com/office/drawing/2014/chartex",
    "cx1": "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex",
    "cx2": "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex",
    "cx3": "http://schemas.microsoft.com/office/drawing/2016/5/9/chartex",
    "cx4": "http://schemas.microsoft.com/office/drawing/2016/5/10/chartex",
    "cx5": "http://schemas.microsoft.com/office/drawing/2016/5/11/chartex",
    "cx6": "http://schemas.microsoft.com/office/drawing/2016/5/12/chartex",
    "cx7": "http://schemas.microsoft.com/office/drawing/2016/5/13/chartex",
    "cx8": "http://schemas.microsoft.com/office/drawing/2016/5/14/chartex",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "o": "urn:schemas-microsoft-com:office:office",
    "v": "urn:schemas-microsoft-com:vml",
    "wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "w10": "urn:schemas-microsoft-com:office:word",
    "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
    "w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
    "w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
    "w16": "http://schemas.microsoft.com/office/word/2018/wordml",
    "w16sdtdh": "http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash",
    "w16se": "http://schemas.microsoft.com/office/word/2015/wordml/symex",
    "wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
    "wne": "http://schemas.microsoft.com/office/word/2006/wordml",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
for prefix, uri in _EXTRA_NS.items():
    ET.register_namespace(prefix, uri)


def tag(ns: str, local: str) -> str:
    """Build a Clark-notation tag: {uri}local."""
    return f"{{{NSMAP[ns]}}}{local}"


# ── DOCX read/write helpers ──────────────────────────────────────────────────


def read_docx(path: str) -> dict[str, bytes]:
    """Read all entries from a DOCX zip into a dict."""
    entries: dict[str, bytes] = {}
    with zipfile.ZipFile(path, "r") as zf:
        for name in zf.namelist():
            entries[name] = zf.read(name)
    return entries


def write_docx(entries: dict[str, bytes], path: str) -> None:
    """Write a dict of entries back to a DOCX zip."""
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_bytes(buf.getvalue())


def parse_xml(data: bytes) -> ET.Element:
    """Parse XML bytes, preserving the declaration."""
    return ET.fromstring(data)


def serialize_xml(root: ET.Element) -> bytes:
    """Serialize an Element back to bytes with XML declaration."""
    return ET.tostring(root, encoding="unicode", xml_declaration=False).encode("utf-8")


# ── Text extraction / replacement helpers ────────────────────────────────────


def get_paragraph_text(para: ET.Element) -> str:
    """Extract full plain text from a w:p element, including hyperlink runs."""
    parts = []
    for elem in para.iter():
        if elem.tag == tag("w", "t"):
            parts.append(elem.text or "")
    return "".join(parts)


def get_run_texts(para: ET.Element) -> list[tuple[ET.Element, str]]:
    """Return list of (w:r element, text) for all runs in a paragraph."""
    results = []
    for r in para.iter(tag("w", "r")):
        t_elem = r.find(tag("w", "t"))
        if t_elem is not None and t_elem.text:
            results.append((r, t_elem.text))
    return results


def clear_header_footer(entries: dict[str, bytes], filename: str) -> None:
    """Clear all content from a header/footer XML file, keeping the root element."""
    key = f"word/{filename}"
    if key not in entries:
        return
    root = parse_xml(entries[key])
    # Remove all child elements (paragraphs) and add one empty paragraph
    for child in list(root):
        root.remove(child)
    # Add a minimal empty paragraph so the XML is valid
    p = ET.SubElement(root, tag("w", "p"))
    ET.SubElement(p, tag("w", "pPr"))
    entries[key] = serialize_xml(root)


def remove_first_paragraph(root: ET.Element) -> None:
    """Remove the first w:p child of w:body (the [Example: ...] note)."""
    body = root.find(tag("w", "body"))
    if body is None:
        return
    first_p = body.find(tag("w", "p"))
    if first_p is not None:
        text = get_paragraph_text(first_p)
        if "[Example:" in text or "[EXAMPLE:" in text.upper():
            body.remove(first_p)
            print(f"  Removed instruction paragraph: {text[:60]}...")


# ── NDA-specific processing ──────────────────────────────────────────────────

NDA_CONTEXT_MAP = {
    "Purpose": ("{purpose}", "[How Confidential Information may be used]"),
    "Effective Date": ("{effective_date}", "[Fill in]"),
    "Term of NDA": ("{nda_term}", "[Agreement term and disclosure period]"),
    "Confidentiality Period": (
        "{confidentiality_period}",
        "[How long Confidential Information is protected]",
    ),
    "Governing Law": ("{governing_law}", "[Fill in]"),
    "Courts": ("{courts}", "[Fill in]"),
}


def process_nda_key_terms(root: ET.Element) -> None:
    """Replace bracketed placeholders in the NDA Key Terms table."""
    body = root.find(tag("w", "body"))
    tables = body.findall(tag("w", "tbl"))

    for tbl in tables:
        rows = tbl.findall(tag("w", "tr"))
        for row in rows:
            cells = row.findall(tag("w", "tc"))
            if len(cells) == 2:
                label_text = get_paragraph_text(cells[0]).strip()
                value_text = get_paragraph_text(cells[1]).strip()

                if label_text in NDA_CONTEXT_MAP:
                    template_tag, expected_placeholder = NDA_CONTEXT_MAP[label_text]
                    replace_cell_text(cells[1], expected_placeholder, template_tag)


def process_nda_signatures(root: ET.Element) -> None:
    """Replace the empty Party Name fields in the signature table."""
    body = root.find(tag("w", "body"))
    tables = body.findall(tag("w", "tbl"))

    party_count = 0
    for tbl in tables:
        for row in tbl.findall(tag("w", "tr")):
            cells = row.findall(tag("w", "tc"))
            for cell in cells:
                for para in cell.findall(tag("w", "p")):
                    text = get_paragraph_text(para)
                    if "Party Name:" in text:
                        party_count += 1
                        tag_name = (
                            "{party_1_name}"
                            if party_count == 1
                            else "{party_2_name}"
                        )
                        append_tag_after_label(para, "Party Name:", tag_name)


def replace_cell_text(
    cell: ET.Element, old_text: str, new_text: str
) -> None:
    """Replace placeholder text in a table cell, preserving formatting of the first run."""
    for para in cell.findall(tag("w", "p")):
        runs = list(para.iter(tag("w", "r")))
        if not runs:
            continue

        # Collect all text across runs
        full_text = get_paragraph_text(para)
        if old_text not in full_text:
            continue

        # Strategy: keep the first run's formatting, set its text to new_text,
        # remove all other runs
        first_run = runs[0]
        t_elem = first_run.find(tag("w", "t"))
        if t_elem is None:
            t_elem = ET.SubElement(first_run, tag("w", "t"))

        t_elem.text = new_text
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

        # Remove formatting that makes it look like a placeholder (italic, color)
        rpr = first_run.find(tag("w", "rPr"))
        if rpr is not None:
            for elem_to_remove in [tag("w", "i"), tag("w", "iCs"), tag("w", "color")]:
                found = rpr.find(elem_to_remove)
                if found is not None:
                    rpr.remove(found)

        # Remove subsequent runs and hyperlinks
        for child in list(para):
            if child.tag == tag("w", "r") and child is not first_run:
                para.remove(child)
            elif child.tag == tag("w", "hyperlink"):
                para.remove(child)

        print(f"  Replaced '{old_text[:40]}...' → '{new_text}'")
        return


def append_tag_after_label(
    para: ET.Element, label: str, template_tag: str
) -> None:
    """After a label like 'Party Name:', add a new run with the template tag.

    Handles the case where the label text is split across multiple runs
    (e.g., 'Party Name' in one run and ':' in another).
    """
    # Collect direct-child runs (not inside hyperlinks)
    direct_runs: list[tuple[ET.Element, ET.Element]] = []  # (run, t_elem)
    for child in para:
        if child.tag == tag("w", "r"):
            t = child.find(tag("w", "t"))
            if t is not None:
                direct_runs.append((child, t))

    if not direct_runs:
        return

    # Build concatenated text and find label position
    full_text = ""
    for _, t in direct_runs:
        full_text += t.text or ""

    if label not in full_text:
        return

    # Find the last run that contributes to the label match
    label_end = full_text.index(label) + len(label)
    char_count = 0
    last_run_elem = direct_runs[-1][0]
    for r_elem, t in direct_runs:
        char_count += len(t.text or "")
        if char_count >= label_end:
            last_run_elem = r_elem
            break

    # Get formatting from the last run in the label
    rpr = last_run_elem.find(tag("w", "rPr"))
    new_run = ET.Element(tag("w", "r"))
    if rpr is not None:
        new_rpr = copy.deepcopy(rpr)
        # Remove bold from the tag value
        for b in [tag("w", "b"), tag("w", "bCs")]:
            found = new_rpr.find(b)
            if found is not None:
                new_rpr.remove(found)
        new_run.append(new_rpr)

    new_t = ET.SubElement(new_run, tag("w", "t"))
    new_t.text = f" {template_tag}"
    new_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # Insert the new run right after the last label run
    children = list(para)
    idx = children.index(last_run_elem)
    para.insert(idx + 1, new_run)

    print(f"  Added '{template_tag}' after '{label}'")


# ── PSA-specific processing ──────────────────────────────────────────────────


PSA_CONTEXT_MAP = {
    "Effective Date": ("{effective_date}", "[Fill in]"),
    "Governing Law": ("{governing_law}", "[Fill in]"),
    "Courts": ("{courts}", "[Fill in]"),
}


def process_psa_key_terms(root: ET.Element) -> None:
    """Replace bracketed placeholders in the PSA Key Terms table."""
    body = root.find(tag("w", "body"))
    tables = body.findall(tag("w", "tbl"))

    for tbl in tables:
        rows = tbl.findall(tag("w", "tr"))
        for row in rows:
            cells = row.findall(tag("w", "tc"))
            if len(cells) == 2:
                label_text = get_paragraph_text(cells[0]).strip()
                value_text = get_paragraph_text(cells[1]).strip()

                if label_text in PSA_CONTEXT_MAP:
                    template_tag, expected_placeholder = PSA_CONTEXT_MAP[label_text]
                    replace_cell_text(cells[1], expected_placeholder, template_tag)


def process_psa_name_of_agreement(root: ET.Element) -> None:
    """Replace [Customer], [Provider], and [Effective Date] in the Name of Agreement row.

    The Name of Agreement text lives in a row of the first table (Cover Page table).
    It's a single-cell row containing text like:
      'The parties will reference the Agreement as: "[Professional Services Agreement]
       between [Customer] and [Provider] dated as of [Effective Date]"'
    """
    body = root.find(tag("w", "body"))
    replacements = {
        "[Customer]": "{customer_name}",
        "[Provider]": "{provider_name}",
        "[Effective Date]": "{effective_date}",
    }

    # Search all tables for paragraphs containing these bracketed placeholders
    for tbl in body.findall(tag("w", "tbl")):
        for row in tbl.findall(tag("w", "tr")):
            for cell in row.findall(tag("w", "tc")):
                for para in cell.findall(tag("w", "p")):
                    full_text = get_paragraph_text(para)
                    if "[Customer]" in full_text or "[Provider]" in full_text or "[Effective Date]" in full_text:
                        replace_bracketed_in_para(para, replacements)


def replace_bracketed_in_para(
    para: ET.Element, replacements: dict[str, str]
) -> None:
    """Replace bracketed text across runs in a paragraph.

    Handles the case where a bracketed placeholder might be split across
    multiple w:r elements (e.g., "[" in one run, "Customer" in another, "]" in a third).

    Rebuilds the text map after each replacement so subsequent replacements
    see the updated text positions.
    """
    for old, new in replacements.items():
        # Collect run elements fresh each iteration
        runs: list[tuple[ET.Element, ET.Element]] = []
        for child in para:
            if child.tag == tag("w", "r"):
                t = child.find(tag("w", "t"))
                if t is not None:
                    runs.append((child, t))
            elif child.tag == tag("w", "hyperlink"):
                for r in child.findall(tag("w", "r")):
                    t = r.find(tag("w", "t"))
                    if t is not None:
                        runs.append((r, t))

        if not runs:
            return

        # Build full text and character-to-run mapping
        full_text = ""
        char_map: list[tuple[int, int]] = []
        for i, (_, t) in enumerate(runs):
            text = t.text or ""
            for j in range(len(text)):
                char_map.append((i, j))
            full_text += text

        pos = full_text.find(old)
        if pos == -1:
            continue

        # Find which runs are involved
        start_run_idx, start_char = char_map[pos]
        end_run_idx, end_char = char_map[pos + len(old) - 1]

        if start_run_idx == end_run_idx:
            # Simple case: all in one run
            _, t = runs[start_run_idx]
            t.text = (t.text or "").replace(old, new, 1)
        else:
            # Multi-run case: put replacement in first run, clear others
            _, first_t = runs[start_run_idx]
            old_first_text = first_t.text or ""
            first_t.text = old_first_text[:start_char] + new

            # Clear middle runs
            for mid_idx in range(start_run_idx + 1, end_run_idx):
                _, mid_t = runs[mid_idx]
                mid_t.text = ""

            # Truncate last run
            _, last_t = runs[end_run_idx]
            old_last_text = last_t.text or ""
            last_t.text = old_last_text[end_char + 1:]

        # Remove placeholder formatting (italic, grey color) from affected runs
        for idx in range(start_run_idx, end_run_idx + 1):
            r_elem, _ = runs[idx]
            rpr = r_elem.find(tag("w", "rPr"))
            if rpr is not None:
                for fmt_tag in [tag("w", "i"), tag("w", "iCs"), tag("w", "color")]:
                    found = rpr.find(fmt_tag)
                    if found is not None:
                        rpr.remove(found)

        print(f"  Replaced '{old}' → '{new}'")


def process_psa_signatures(root: ET.Element) -> None:
    """Replace empty Customer/Provider name fields in the PSA signature table.

    The PSA signature block has two side-by-side cells. Each starts with
    "Customer:" or "Provider:" followed by fields like Company:, etc.
    We add the template tag after "Company:" in each cell.
    """
    body = root.find(tag("w", "body"))
    tables = body.findall(tag("w", "tbl"))

    for tbl in tables:
        rows = tbl.findall(tag("w", "tr"))
        if not rows:
            continue
        first_row_text = get_paragraph_text(rows[0]).strip()
        if "Signature" not in first_row_text:
            continue

        for row in rows:
            cells = row.findall(tag("w", "tc"))
            for cell in cells:
                paras = cell.findall(tag("w", "p"))

                # Determine if this is customer or provider signature block
                is_customer = False
                is_provider = False
                for p in paras:
                    pt = get_paragraph_text(p).strip()
                    if pt == "Customer:" or pt.startswith("Customer:"):
                        is_customer = True
                        break
                    if pt == "Provider:" or pt.startswith("Provider:"):
                        is_provider = True
                        break

                if not is_customer and not is_provider:
                    continue

                tag_name = "{customer_name}" if is_customer else "{provider_name}"

                # Add template tag after "Company:" line
                for p in paras:
                    pt = get_paragraph_text(p).strip()
                    if pt.startswith("Company:"):
                        append_tag_after_label(p, "Company:", tag_name)
                        break


# ── Main processing ──────────────────────────────────────────────────────────


def process_nda(source: str, dest: str) -> None:
    """Process the NDA cover page into a template."""
    print(f"\nProcessing NDA: {source}")
    entries = read_docx(source)

    # Parse document.xml
    doc_xml = parse_xml(entries["word/document.xml"])

    # Step 1: Remove [Example: ...] note
    remove_first_paragraph(doc_xml)

    # Step 2: Clear artifact headers/footers
    clear_header_footer(entries, "header2.xml")
    clear_header_footer(entries, "footer1.xml")
    clear_header_footer(entries, "footer2.xml")
    print("  Cleared header2.xml, footer1.xml, footer2.xml")

    # Step 3: Replace key terms placeholders
    process_nda_key_terms(doc_xml)

    # Step 4: Add party name tags to signature blocks
    process_nda_signatures(doc_xml)

    # Write back
    entries["word/document.xml"] = serialize_xml(doc_xml)
    write_docx(entries, dest)
    print(f"  Written to: {dest}")


def process_psa(source: str, dest: str) -> None:
    """Process the PSA cover page into a template."""
    print(f"\nProcessing PSA: {source}")
    entries = read_docx(source)

    # Parse document.xml
    doc_xml = parse_xml(entries["word/document.xml"])

    # Step 1: Remove [Example: ...] note
    remove_first_paragraph(doc_xml)

    # Step 2: Clear artifact headers/footers
    clear_header_footer(entries, "header2.xml")
    clear_header_footer(entries, "footer1.xml")
    clear_header_footer(entries, "footer2.xml")
    print("  Cleared header2.xml, footer1.xml, footer2.xml")

    # Step 3: Replace Name of Agreement placeholders
    process_psa_name_of_agreement(doc_xml)

    # Step 4: Replace key terms placeholders
    process_psa_key_terms(doc_xml)

    # Step 5: Add party name tags to signature blocks
    process_psa_signatures(doc_xml)

    # Write back
    entries["word/document.xml"] = serialize_xml(doc_xml)
    write_docx(entries, dest)
    print(f"  Written to: {dest}")


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    sources_dir = Path("/tmp/bonterms-sources")

    nda_source = sources_dir / "nda-cover-page.docx"
    psa_source = sources_dir / "psa-cover-page.docx"

    if not nda_source.exists():
        print(f"Error: {nda_source} not found", file=sys.stderr)
        sys.exit(1)
    if not psa_source.exists():
        print(f"Error: {psa_source} not found", file=sys.stderr)
        sys.exit(1)

    nda_dest = project_root / "templates" / "bonterms-mutual-nda" / "template.docx"
    psa_dest = (
        project_root
        / "templates"
        / "bonterms-professional-services-agreement"
        / "template.docx"
    )

    process_nda(str(nda_source), str(nda_dest))
    process_psa(str(psa_source), str(psa_dest))

    print("\nDone! Templates generated:")
    print(f"  {nda_dest}")
    print(f"  {psa_dest}")


if __name__ == "__main__":
    main()
