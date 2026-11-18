import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    "benchmark", pathlib.Path(__file__).with_name("benchmark.py")
)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class BenchmarkTests(unittest.TestCase):
    def test_cost_includes_thinking_and_cached_tokens(self):
        usage = {
            "promptTokenCount": 1000,
            "cachedContentTokenCount": 200,
            "candidatesTokenCount": 300,
            "thoughtsTokenCount": 400,
        }
        self.assertAlmostEqual(
            b.cost("gemini-4-argon", usage), (0.8 * 2 + 0.2 * 0.1 + 0.7 * 10) / 1000
        )
        self.assertAlmostEqual(
            b.cost("gemini-4-argon", usage, True), 2 * b.cost("gemini-4-argon", usage)
        )

    def test_full_document_detects_footer_and_final_paragraph(self):
        with tempfile.TemporaryDirectory() as d:

            def make(name, last, footer):
                path = pathlib.Path(d) / name
                with zipfile.ZipFile(path, "w") as z:
                    for part, text in [
                        (
                            "document",
                            "First paragraph</w:t></w:r></w:p><w:p><w:r><w:t>" + last,
                        ),
                        ("footer1", footer),
                    ]:
                        z.writestr(
                            f"word/{part}.xml",
                            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>'
                            + text
                            + "</w:t></w:r></w:p></w:document>",
                        )
                return b.docx_parts(path)

            gold = make("gold.docx", "Last paragraph", "Right footer")
            self.assertNotEqual(
                gold, make("wrong-body.docx", "Wrong last paragraph", "Right footer")
            )
            self.assertNotEqual(
                gold, make("wrong-footer.docx", "Last paragraph", "Wrong footer")
            )

    def test_seven_complete_synthetic_fixtures(self):
        fixtures = list((b.HERE / "fixtures").glob("*.json"))
        self.assertEqual(len(fixtures), 7)
        for p in fixtures:
            f = json.loads(p.read_text())
            self.assertTrue(f["expected"])
            self.assertIn(".example", f["deal"]) if "common-paper" in p.name else None


if __name__ == "__main__":
    unittest.main()
