import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonical = value => {
  const result = canonicalize(value);
  if (result === undefined) throw new Error('Original verification value cannot be canonicalized');
  return result;
};

function scalarValue(field, caseId, ordinal) {
  if (field.default !== undefined) {
    if (field.type === 'boolean') return field.default === 'true';
    if (field.type === 'number') return Number(field.default);
    if (field.type === 'multiselect') return [];
    return field.default;
  }
  switch (field.type) {
    case 'boolean': return false;
    case 'number': return 1000 + ordinal;
    case 'enum': return field.options?.[0] ?? '';
    case 'multiselect': return field.options?.slice(0, 1) ?? [];
    case 'date': return '2026-09-15';
    case 'string': {
      if (field.value_format === 'email' || /email/i.test(field.name)) return `verify-${ordinal}@example.test`;
      if (field.value_format === 'url' || /(?:url|website)$/i.test(field.name)) return `https://example.test/${caseId}/${ordinal}`;
      if (/date/i.test(field.name)) return 'September 15, 2026';
      return `OA_VERIFY_${field.name}_${caseId}_${ordinal}`;
    }
    default: return '';
  }
}

function arrayRows(field, count, caseId) {
  return Array.from({ length: count }, (_, row) => Object.fromEntries(
    (field.items ?? []).map((item, column) => [item.name, scalarValue(item, `${caseId}_ROW_${row + 1}`, column)]),
  ));
}

function baselineValues(fields, caseId) {
  return Object.fromEntries(fields.filter(field => !field.derived).map((field, index) => {
    if (field.type === 'array') return [field.name, arrayRows(field, 1, `${caseId}_${field.name}`)];
    if (field.statutory_compliance_representation) return [field.name, false];
    return [field.name, scalarValue(field, caseId, index)];
  }));
}

/** Public-projection cases retained as a stable unit-test/API surface. */
export function generateVerificationCases(metadata) {
  const cases = [];
  const add = (id, purpose, mutate) => {
    const values = baselineValues(metadata.fields, id);
    mutate?.(values);
    cases.push({ id, purpose, values });
  };
  add('baseline', 'Every public field receives a representative typed value; arrays contain one row.');
  for (const field of metadata.fields) {
    if (field.derived) continue;
    if (field.type === 'boolean' && !field.statutory_compliance_representation) {
      add(`boolean-${field.name}-false`, `Boolean ${field.name}=false.`, values => { values[field.name] = false; });
      add(`boolean-${field.name}-true`, `Boolean ${field.name}=true.`, values => { values[field.name] = true; });
    } else if (field.type === 'boolean') {
      add(`statutory-${field.name}-unconfirmed`, `Statutory representation ${field.name} remains false; no real-world attestation is synthesized.`, values => { values[field.name] = false; });
    } else if (field.type === 'enum') {
      for (const option of field.options ?? []) add(`enum-${field.name}-${option}`, `Enum ${field.name} alternative ${option}.`, values => { values[field.name] = option; });
    } else if (field.type === 'multiselect') {
      add(`multiselect-${field.name}-empty`, `Multiselect ${field.name} empty selection.`, values => { values[field.name] = []; });
      for (const option of field.options ?? []) add(`multiselect-${field.name}-${option}`, `Multiselect ${field.name} includes ${option}.`, values => { values[field.name] = [option]; });
      if ((field.options?.length ?? 0) > 1) add(`multiselect-${field.name}-all`, `Multiselect ${field.name} includes every option.`, values => { values[field.name] = [...field.options]; });
    } else if (field.type === 'array') {
      for (const count of [0, 1, 2]) {
        add(`array-${field.name}-${count}`, `Array ${field.name} contains ${count} row(s).`, values => { values[field.name] = arrayRows(field, count, `array-${field.name}-${count}`); });
        if (count === 0 && metadata.priority_fields.includes(field.name)) cases.at(-1).expected_error = `Required collection fields are empty: ${field.name}`;
      }
    }
  }
  return [...new Map(cases.map(item => [sha256(canonical(item.values)), item])).values()];
}

function canonicalOnlyCases(contract) {
  const hidden = contract.fields.filter(field => !contract.publicFields.includes(field.name) && !field.derived && !field.derived_gate);
  if (!hidden.length) return [];
  const base = baselineValues(contract.fields.filter(field => contract.publicFields.includes(field.name)), 'canonical-base');
  const cases = [];
  const add = (id, purpose, field, value) => cases.push({ id, purpose, mode: 'canonical-only', values: { ...base, [field.name]: value } });
  for (const field of hidden) {
    if (field.type === 'boolean') {
      add(`canonical-${field.name}-false`, `Canonical-only Boolean branch ${field.name}=false.`, field, false);
      if (!field.statutory_compliance_representation) add(`canonical-${field.name}-true`, `Canonical-only Boolean branch ${field.name}=true.`, field, true);
    } else if (field.type === 'enum') {
      for (const option of field.options ?? []) add(`canonical-${field.name}-${option}`, `Canonical-only enum ${field.name}=${option}.`, field, option);
    } else if (field.type === 'array') {
      for (const count of [0, 1, 2]) add(`canonical-${field.name}-${count}`, `Canonical-only array ${field.name} has ${count} row(s).`, field, arrayRows(field, count, `canonical-${field.name}-${count}`));
    } else add(`canonical-${field.name}`, `Canonical-only typed field ${field.name}.`, field, scalarValue(field, `canonical-${field.name}`, 0));
  }
  return cases;
}

function truthyBranchCases(contract) {
  const base = baselineValues(contract.fields.filter(field => contract.publicFields.includes(field.name)), 'branch-base');
  const byName = new Map(contract.fields.map(field => [field.name, field]));
  const derived = new Set(contract.derivedGates.map(gate => gate.field));
  const branchNames = new Set(contract.sourceBindings.filter(binding => binding.kind === 'branch').map(binding => binding.field));
  const cases = [];
  for (const name of branchNames) {
    const field = byName.get(name);
    if (!field || derived.has(name) || !['string', 'date'].includes(field.type)) continue;
    cases.push({ id: `branch-${name}-empty`, purpose: `Truthy branch ${name} is inactive for an empty scalar.`, values: { ...base, [name]: '' }, mode: 'canonical-only' });
    cases.push({ id: `branch-${name}-present`, purpose: `Truthy branch ${name} is active for a non-empty scalar.`, values: { ...base, [name]: scalarValue(field, `branch-${name}`, 0) }, mode: 'canonical-only' });
    if (field.type === 'string') {
      cases.push({ id: `branch-${name}-literal-false`, purpose: `Literal string "false" is nonempty text, never Boolean false.`, values: { ...base, [name]: 'false' }, mode: 'canonical-only' });
    }
  }
  return cases;
}

function derivedGateCases(contract) {
  const base = baselineValues(contract.fields.filter(field => contract.publicFields.includes(field.name)), 'derived-base');
  const byName = new Map(contract.fields.map(field => [field.name, field]));
  return contract.derivedGates.flatMap(gate => {
    const controllable = gate.dependsOn.filter(name => !contract.derivedGates.some(candidate => candidate.field === name));
    const safeTrue = controllable.filter(name => !byName.get(name)?.statutory_compliance_representation);
    const cases = [{ id: `derived-${gate.field}-all-false`, purpose: `Derived gate ${gate.field} is evaluated with every direct dependency false.`, values: { ...base, ...Object.fromEntries(controllable.map(name => [name, false])) }, mode: 'canonical-only' }];
    if (safeTrue.length === controllable.length) cases.push({ id: `derived-${gate.field}-all-true`, purpose: `Derived gate ${gate.field} is evaluated with every direct dependency true.`, values: { ...base, ...Object.fromEntries(controllable.map(name => [name, true])) }, mode: 'canonical-only' });
    return cases;
  });
}

function confirmationCases(contract) {
  const base = baselineValues(contract.fields.filter(field => contract.publicFields.includes(field.name)), 'confirm-base');
  return contract.confirmClauses.flatMap(clause => {
    const cases = [];
    if (clause.condition) cases.push({ id: `confirm-${clause.confirm}-not-applicable`, purpose: `Mechanical confirmation regression: ${clause.confirm}=false while ${clause.condition}=false; this is synthetic and makes no real-world attestation.`, values: { ...base, [clause.condition]: false, [clause.confirm]: false }, mode: 'canonical-only' });
    cases.push({ id: `confirm-${clause.confirm}-pending`, purpose: `Mechanical confirmation regression: applicable with ${clause.confirm}=false; this is synthetic and makes no real-world attestation.`, values: { ...base, ...(clause.condition ? { [clause.condition]: true } : {}), [clause.confirm]: false }, mode: 'canonical-only' });
    cases.push({ id: `confirm-${clause.confirm}-confirmed-SYNTHETIC-NOT-ATTESTATION`, purpose: `SYNTHETIC REGRESSION ONLY: exercises confirmed rendering; ${clause.confirm}=true is not a real-world attestation and must never be reused as user data.`, values: { ...base, ...(clause.condition ? { [clause.condition]: true } : {}), [clause.confirm]: true }, mode: 'canonical-only' });
    return cases;
  });
}

export function generateOriginalVerificationCases(contract) {
  const cases = [
    ...generateVerificationCases(contract.metadata), ...canonicalOnlyCases(contract),
    ...truthyBranchCases(contract), ...derivedGateCases(contract), ...confirmationCases(contract),
  ];
  const seen = new Set();
  for (const item of cases) {
    if (seen.has(item.id)) throw new Error(`Duplicate original verification case ID: ${item.id}`);
    seen.add(item.id);
  }
  return cases;
}

export function expectedOriginalCaseInventory(contract) {
  const cases = generateOriginalVerificationCases(contract);
  return cases.map(item => ({ id: item.id, values_sha256: sha256(canonical(item.values)) }));
}
