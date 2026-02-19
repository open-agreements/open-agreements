import { describe, expect } from 'vitest';
import { join } from 'node:path';
import { validateRecipe } from '../src/core/validation/recipe.js';
import { validateRecipeMetadata } from '../src/core/metadata.js';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const recipesDir = join(import.meta.dirname, '..', 'content', 'recipes');
const it = itAllure.epic('Verification & Drift');

describe('validateRecipe', () => {
  it('validates nvca-voting-agreement (full recipe)', async () => {
    const dir = join(recipesDir, 'nvca-voting-agreement');
    await allureParameter('recipe_id', 'nvca-voting-agreement');
    const result = await allureStep('Validate full recipe', () =>
      validateRecipe(dir, 'nvca-voting-agreement')
    );
    await allureJsonAttachment('recipe-validation-result.json', result);
    await allureStep('Assert recipe has no validation errors', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it.openspec('OA-032')('validates nvca-certificate-of-incorporation (scaffold)', async () => {
    const dir = join(recipesDir, 'nvca-certificate-of-incorporation');
    await allureParameter('recipe_id', 'nvca-certificate-of-incorporation');
    const result = await allureStep('Validate scaffold recipe', () =>
      validateRecipe(dir, 'nvca-certificate-of-incorporation')
    );
    await allureJsonAttachment('recipe-validation-result.json', result);
    await allureStep('Assert scaffold recipe passes validation', () => {
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateRecipeMetadata', () => {
  it('validates nvca-voting-agreement metadata', async () => {
    const dir = join(recipesDir, 'nvca-voting-agreement');
    await allureParameter('recipe_id', 'nvca-voting-agreement');
    const result = await allureStep('Validate recipe metadata', () =>
      validateRecipeMetadata(dir)
    );
    await allureJsonAttachment('recipe-metadata-validation-result.json', result);
    await allureStep('Assert metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });

  it('validates scaffold metadata', async () => {
    const dir = join(recipesDir, 'nvca-management-rights-letter');
    await allureParameter('recipe_id', 'nvca-management-rights-letter');
    const result = await allureStep('Validate scaffold metadata', () =>
      validateRecipeMetadata(dir)
    );
    await allureJsonAttachment('recipe-metadata-validation-result.json', result);
    await allureStep('Assert scaffold metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });
});
