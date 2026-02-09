import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { validateRecipe } from '../src/core/validation/recipe.js';
import { validateRecipeMetadata } from '../src/core/metadata.js';

const recipesDir = join(import.meta.dirname, '..', 'recipes');

describe('validateRecipe', () => {
  it('validates nvca-voting-agreement (full recipe)', () => {
    const dir = join(recipesDir, 'nvca-voting-agreement');
    const result = validateRecipe(dir, 'nvca-voting-agreement');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates nvca-certificate-of-incorporation (scaffold)', () => {
    const dir = join(recipesDir, 'nvca-certificate-of-incorporation');
    const result = validateRecipe(dir, 'nvca-certificate-of-incorporation');
    expect(result.valid).toBe(true);
  });
});

describe('validateRecipeMetadata', () => {
  it('validates nvca-voting-agreement metadata', () => {
    const dir = join(recipesDir, 'nvca-voting-agreement');
    const result = validateRecipeMetadata(dir);
    expect(result.valid).toBe(true);
  });

  it('validates scaffold metadata', () => {
    const dir = join(recipesDir, 'nvca-management-rights-letter');
    const result = validateRecipeMetadata(dir);
    expect(result.valid).toBe(true);
  });
});
