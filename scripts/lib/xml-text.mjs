const XML_ENTITIES = Object.freeze({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
});

/** Decode one XML text layer only; never rescan decoded ampersands. */
export function decodeXmlText(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, entity => XML_ENTITIES[entity]);
}
