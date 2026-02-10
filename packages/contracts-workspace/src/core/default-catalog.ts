import type { FormsCatalog } from './types.js';

export function createDefaultCatalog(): FormsCatalog {
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    entries: [
      {
        id: 'yc-safe-valuation-cap',
        name: 'YC Post-Money SAFE - Valuation Cap',
        source_url:
          'https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Valuation%20Cap%20Only%20-%20FINAL-f2a64add6d21039ab347ee2e7194141a4239e364ffed54bad0fe9cf623bf1691.docx',
        checksum: {
          sha256: '185d24f5bcf13acdf1419bf1d420771088da5dea3b3f3e0cdc7fa5df643649c4',
        },
        license: {
          type: 'CC-BY-ND-4.0',
          redistribution: 'allowed-unmodified',
        },
        destination_lifecycle: 'forms',
        destination_topic: 'finance',
        notes: 'Official YC downloadable document. Do not redistribute modified versions.',
      },
      {
        id: 'yc-safe-discount',
        name: 'YC Post-Money SAFE - Discount',
        source_url:
          'https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Discount%20Only%20-%20FINAL-b9ecb516615d60c6c4653507442aa2561023004368232b7d6e75edc9629acc99.docx',
        checksum: {
          sha256: '93d606fc568e39673ab96c581850ece30b4f478972b7b4d4d132df695264b5a5',
        },
        license: {
          type: 'CC-BY-ND-4.0',
          redistribution: 'allowed-unmodified',
        },
        destination_lifecycle: 'forms',
        destination_topic: 'finance',
        notes: 'Official YC downloadable document. Do not redistribute modified versions.',
      },
      {
        id: 'yc-safe-mfn',
        name: 'YC Post-Money SAFE - MFN',
        source_url:
          'https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20MFN%20Only%20-%20FINAL-2bc87fa3d2ec5072a60d653aec9a885fb43879781e44341fa720a8e7d1cc42ff.docx',
        checksum: {
          sha256: 'd3ad99466059b6f4d838e8e5daeeff5752e9866e6b557c6056df772f8509e727',
        },
        license: {
          type: 'CC-BY-ND-4.0',
          redistribution: 'allowed-unmodified',
        },
        destination_lifecycle: 'forms',
        destination_topic: 'finance',
        notes: 'Official YC downloadable document. Do not redistribute modified versions.',
      },
      {
        id: 'yc-safe-pro-rata-side-letter',
        name: 'YC Pro Rata Side Letter',
        source_url:
          'https://bookface-static.ycombinator.com/assets/ycdc/Pro%20Rata%20Side%20Letter-d6dd8d827741862b18fba0f658da17fb4e787e5f2dda49584b9caea89bf42302.docx',
        checksum: {
          sha256: '9b769a6a724da0c40e6649df8c774f49cc20dafe7247cc366ce4b98b4c2a3510',
        },
        license: {
          type: 'CC-BY-ND-4.0',
          redistribution: 'allowed-unmodified',
        },
        destination_lifecycle: 'forms',
        destination_topic: 'finance',
        notes: 'Official YC downloadable document. Do not redistribute modified versions.',
      },
    ],
  };
}
