import type { ClassifierEvalSet, GateEvalSet } from './eval-sets.js';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadEvalSets, parseEvalSet } from './eval-sets.js';

const SETS_DIR = fileURLToPath(
  new URL('../../classifier-eval/sets', import.meta.url),
);

async function loadCommittedSets() {
  const result = await loadEvalSets(SETS_DIR);
  if (!result.ok) throw new Error(result.error.message);
  return result.sets;
}

async function loadClassifierSet(id: string): Promise<ClassifierEvalSet> {
  const set = (await loadCommittedSets()).find(
    (candidate) => candidate.id === id,
  );
  if (set?.kind !== 'classifier') throw new Error(`no classifier set ${id}`);
  return set;
}

async function loadGateSet(): Promise<GateEvalSet> {
  const set = (await loadCommittedSets()).find(
    (candidate) => candidate.kind === 'gate',
  );
  if (set?.kind !== 'gate') throw new Error('no gate set');
  return set;
}

describe('loadEvalSets', () => {
  it('loads the three committed sets, in order, with 18, 24 and 12 messages', async () => {
    const sets = await loadCommittedSets();

    expect(sets.map((set) => [set.id, set.kind, set.messages.length])).toEqual([
      ['addendum-18', 'classifier', 18],
      ['rebuilt-24', 'classifier', 24],
      ['safety-gate-12', 'gate', 12],
    ]);
  });

  it('gives every message in a set a distinct id, and no two sets share a message id', async () => {
    const sets = await loadCommittedSets();
    const ids = sets.flatMap((set) =>
      set.messages.map((message) => message.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns a typed failure, not a throw, when the directory has no set files', async () => {
    const result = await loadEvalSets(`${SETS_DIR}/does-not-exist`);

    expect(result.ok).toBe(false);
  });
});

describe('the addendum set', () => {
  it("copies the 3.12 addendum table's 18 messages and each New-prompt band exactly", async () => {
    const set = await loadClassifierSet('addendum-18');
    const adr = await readFile(
      fileURLToPath(
        new URL(
          '../../../../docs/decisions/STAGE-1-CLASSIFIER.md',
          import.meta.url,
        ),
      ),
      'utf8',
    );
    // A row reads `| "<message>" (note) | <old> (<Band>) | <new> (<Band>[, note]) |`.
    const rowPattern = /^\| "(.+?)"[^|]*\|[^|]*\|\s*\d+ \((High|Mid|Low)/gm;
    const tabulated = [...adr.matchAll(rowPattern)].map((match) => [
      match[1],
      match[2]?.toLowerCase(),
    ]);

    expect(tabulated).toHaveLength(18);
    expect(
      set.messages.map((message) => [message.text, message.expectedBands[0]]),
    ).toEqual(tabulated);
    expect(set.messages.map((message) => message.expectedBands.length)).toEqual(
      Array.from({ length: 18 }, () => 1),
    );
  });
});

describe('the rebuilt set', () => {
  it('has 8 work, 8 banter and 8 ambiguous messages', async () => {
    const set = await loadClassifierSet('rebuilt-24');
    const countOf = (prefix: string) =>
      set.messages.filter((message) => message.id.startsWith(prefix)).length;

    expect([
      countOf('work-'),
      countOf('banter-'),
      countOf('ambiguous-'),
    ]).toEqual([8, 8, 8]);
  });

  it('expects work High, banter Low, a signal Mid or High and a non-actionable message Low', async () => {
    const set = await loadClassifierSet('rebuilt-24');
    const expectationByLabel = (label: string) => [
      ...new Set(
        set.messages
          .filter((message) => message.label === label)
          .map((message) => message.expectedBands.join('/')),
      ),
    ];

    expect(expectationByLabel('work')).toEqual(['high']);
    expect(expectationByLabel('banter')).toEqual(['low']);
    expect(expectationByLabel('signal')).toEqual(['mid/high']);
    expect(expectationByLabel('non-actionable')).toEqual(['low']);
  });

  it("labels every ambiguous message signal or non-actionable, and includes Decision 2's four named examples and Decision 3's coffee machine", async () => {
    const set = await loadClassifierSet('rebuilt-24');
    const ambiguous = set.messages.filter((message) =>
      message.id.startsWith('ambiguous-'),
    );
    const messageWithText = (text: string) =>
      set.messages.find((message) => message.text === text);

    expect(
      ambiguous.every((message) =>
        ['signal', 'non-actionable'].includes(message.label),
      ),
    ).toBe(true);
    expect(
      [
        'the footer links look broken on the mobile site',
        'I keep getting logged out of the admin panel',
        'the dashboard has been loading really slowly today',
        'do we have a billing docs page somewhere?',
      ].map((text) => messageWithText(text)?.label),
    ).toEqual(['signal', 'signal', 'signal', 'signal']);
    expect(messageWithText('the coffee machine is broken again')?.label).toBe(
      'banter',
    );
  });
});

describe('the safety-gate set', () => {
  it('has 6 sensitive messages expecting appropriate false and 6 routine ones expecting true', async () => {
    const set = await loadGateSet();
    const expectedFalse = set.messages.filter(
      (message) => !message.expectedAppropriate,
    );
    const expectedTrue = set.messages.filter(
      (message) => message.expectedAppropriate,
    );

    expect(expectedFalse.map((message) => message.label)).toEqual([
      'layoff',
      'layoff',
      'death',
      'death',
      'grief',
      'personal crisis',
    ]);
    expect(expectedTrue).toHaveLength(6);
  });

  it('makes at least 3 of the routine messages urgent technical ones', async () => {
    const set = await loadGateSet();

    expect(
      set.messages.filter(
        (message) =>
          message.expectedAppropriate && message.label === 'urgent technical',
      ).length,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('parseEvalSet', () => {
  it('rejects a classifier message with no expected band, so a set can never score against nothing', () => {
    const result = parseEvalSet({
      id: 's',
      kind: 'classifier',
      description: 'd',
      messages: [{ id: 'm', label: 'l', text: 't', expectedBands: [] }],
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a set that repeats a message id', () => {
    const message = {
      id: 'm',
      label: 'l',
      text: 't',
      expectedAppropriate: true,
    };
    const result = parseEvalSet({
      id: 's',
      kind: 'gate',
      description: 'd',
      messages: [message, message],
    });

    expect(result.ok).toBe(false);
  });
});
