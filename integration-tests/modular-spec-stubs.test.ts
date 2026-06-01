/**
 * Pending bindings for restructuring-only stub capabilities.
 */

import { describe } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

describe('modular spec stubs', () => {
  const platform = itAllure.epic('Platform & Distribution');
  const signing = itAllure.epic('Agreement Signing');

  platform
    .openspec('OA-LEG-001')
    .skip(
      'Restructure-only tombstone scenario; no runtime behavior exists beyond the canonical spec file.',
      () => {},
    );

  signing
    .openspec('OA-SIG-000')
    .skip(
      'Signing capability is a restructuring stub until add-agreement-signing is archived into the new capability.',
      () => {},
    );

  signing
    .openspec('OA-DSG-000')
    .skip(
      'DocuSign provider capability is a restructuring stub until add-agreement-signing is archived into the new capability.',
      () => {},
    );
});
