import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { processTimeline, truncateTask, isVacation } from '../process.js';

const original = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));

test('truncateTask keeps 45 characters including trailing space', () => {
  const task = '№6 ГЕО у детей: Создание бесплатной подписки Радар+Мегасемья для детского профиля';
  assert.equal(truncateTask(task).length, 45);
  assert.equal(truncateTask('5G турбо'), '5G турбо');
});

test('isVacation detects отпуск cells', () => {
  assert.equal(isVacation('отпуск'), true);
  assert.equal(isVacation('отпуск QA'), true);
  assert.equal(isVacation('QA'), false);
});

test('processTimeline matches precomputed conflicts and weekly from data.json', () => {
  const processed = processTimeline({
    generated: original.generated,
    teams: original.teams,
    weeks: original.weeks,
    entries: original.entries,
  });

  assert.equal(processed.conflicts.length, original.conflicts.length);
  assert.deepEqual(processed.conflicts, original.conflicts);
  assert.equal(processed.weekly.length, original.weekly.length);
  assert.deepEqual(processed.weekly, original.weekly);
});

test('processTimeline infers weeks and team colors from entries', () => {
  const processed = processTimeline({
    entries: [
      {
        team: 'Alpha',
        task: 'One',
        resource: 'Ann',
        role: 'FE',
        weeks: { '2026-08-10': 'FE' },
      },
      {
        team: 'Beta',
        task: 'Two',
        resource: 'Bob',
        role: 'FE',
        weeks: { '2026-08-10': 'FE', '2026-08-17': 'FE' },
      },
    ],
  });

  assert.equal(processed.weeks.length, 2);
  assert.equal(processed.weeks[0].label, '10.08');
  assert.equal(processed.teams.Alpha.full, 'Alpha');
  assert.ok(processed.teams.Alpha.color);
  assert.equal(processed.conflicts.length, 1);
  assert.equal(processed.conflicts[0].role, 'FE');
  assert.deepEqual(processed.conflicts[0].teams, ['Alpha', 'Beta']);
  assert.equal(processed.weekly[0].total, 2);
  assert.equal(processed.weekly[1].total, 1);
});
