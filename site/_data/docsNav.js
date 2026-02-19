/**
 * Sidebar navigation structure for /docs/ pages.
 * Sections and items are rendered in the order listed here.
 */
export default function () {
  return [
    {
      section: "Start Here",
      items: [
        { title: "Getting Started", slug: "getting-started" },
      ],
    },
    {
      section: "Guides",
      items: [
        { title: "Adding Templates", slug: "adding-templates" },
        { title: "Adding Recipes", slug: "adding-recipes" },
        { title: "Branding Pipeline", slug: "template-branding-pipeline" },
      ],
    },
    {
      section: "Packages",
      items: [
        { title: "Contracts Workspace CLI", slug: "contracts-workspace" },
      ],
    },
    {
      section: "Reference",
      items: [
        { title: "Licensing", slug: "licensing" },
        { title: "Trust Checklist", slug: "trust-checklist" },
        { title: "Supported Tools", slug: "supported-tools" },
        { title: "Assumptions", slug: "assumptions" },
        { title: "Employment Source Policy", slug: "employment-source-policy" },
      ],
    },
  ];
}
