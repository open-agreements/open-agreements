/**
 * Sidebar navigation structure for /docs/ pages.
 * Sections and items are rendered in the order listed here.
 */
export default function () {
  return [
    {
      section: "Start Here",
      items: [
        { title: "Documentation Home", slug: "index" },
        { title: "Installation", slug: "installation" },
        { title: "Quick Start", slug: "quickstart" },
        { title: "Troubleshooting", slug: "troubleshooting" },
      ],
    },
    {
      section: "Workflows",
      items: [
        { title: "Use Legal Content", slug: "workflows/use-legal-content" },
        { title: "Connect an AI Agent", slug: "using-with-ai-agents" },
        { title: "Contracts Workspace", slug: "contracts-workspace" },
      ],
    },
    {
      section: "Contribute",
      items: [
        { title: "Adding Templates", slug: "adding-templates" },
        { title: "Adding Field-selectors", slug: "adding-field-selectors" },
      ],
    },
    {
      section: "Concepts and Internals",
      items: [
        { title: "Legal Content and Document Mechanics", slug: "concepts/content-and-documents" },
        { title: "Architecture", slug: "architecture" },
        { title: "Known Limitations", slug: "limitations" },
      ],
    },
    {
      section: "Reference",
      items: [
        { title: "Catalog", slug: "reference/catalog" },
        { title: "CLI", slug: "reference/cli" },
        { title: "Licensing", slug: "licensing" },
        { title: "Changelog & Release Process", slug: "changelog-release-process" },
        { title: "Trust Boundary Status", slug: "trust-checklist" },
        { title: "Supported Tools", slug: "supported-tools" },
        { title: "Assumptions", slug: "assumptions" },
        { title: "Employment Source Policy", slug: "employment-source-policy" },
      ],
    },
  ];
}
