import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeEntry, anonymizeTimeline, anonymizeRoster, anonymizeTeams, specialtyLabel } from '../anon.js';
import { processTimeline } from '../process.js';

test('specialtyLabel uses the role and marks потребность slots', () => {
  assert.equal(specialtyLabel({ role: 'QA', resource: 'Шлотгауэр Иван' }), 'QA');
  assert.equal(specialtyLabel({ role: 'Дизайн', resource: 'Потребность дизайн ЦКО' }), 'Дизайн (потребность)');
  assert.equal(specialtyLabel({ role: '', resource: 'Кто-то' }), '—');
});

test('anonymizeEntry replaces task titles, names and tickets', () => {
  const out = anonymizeEntry({
    team: 'Тарифы',
    task: 'Новый экран Мой тариф',
    resource: 'Калинкин',
    role: 'Дизайн',
    ticket: 'B2CPROD-1',
    weeks: { '2026-08-24': '5' },
  });
  assert.equal(out.task, 'задача');
  assert.equal(out.resource, 'Дизайн');
  assert.equal(out.ticket, '');
  assert.equal(out.team, 'Тарифы');
});

test('anonymized h2 timeline has no personal names or task titles', () => {
  const raw = JSON.parse(readFileSync(new URL('../data-h2-2026.json', import.meta.url), 'utf8'));
  const anon = anonymizeTimeline(raw);
  const processed = processTimeline(anon);
  assert.ok(processed.entries.length > 0);
  assert.ok(processed.entries.every((entry) => entry.task === 'задача'));
  assert.ok(processed.entries.every((entry) => entry.ticket === ''));
  const blob = JSON.stringify(processed.entries);
  for (const name of ['Калинкин', 'Мерзликин', 'Шлотгауэр', 'Жогина', 'Косенко', 'Мой тариф']) {
    assert.equal(blob.includes(name), false, `leaked ${name}`);
  }
  assert.ok(processed.conflicts.every((conflict) =>
    conflict.tasks.every((label) => label.includes('задача') && !/Калинкин|Мерзликин|B2CPROD/i.test(label))
  ));
});

test('anonymizeTeams numbers teams in stable key order', () => {
  const renamed = anonymizeTeams({
    Монетизация: { full: 'Монетизация', color: '#2E75B6' },
    ДИ: { full: 'Домашний интернет' },
  });
  assert.equal(renamed.Монетизация.full, 'Команда 1');
  assert.equal(renamed.ДИ.full, 'Команда 2');
  assert.equal(renamed.Монетизация.color, '#2E75B6');
});

test('anonymized h2 timeline shows Команда N instead of real team names', () => {
  const raw = JSON.parse(readFileSync(new URL('../data-h2-2026.json', import.meta.url), 'utf8'));
  const keys = Object.keys(raw.teams);
  const anon = anonymizeTimeline(raw);
  keys.forEach((key, index) => {
    assert.equal(anon.teams[key].full, `Команда ${index + 1}`);
  });
  const processed = processTimeline(anon);
  const displayNames = Object.values(processed.teams).map((team) => team.full);
  assert.deepEqual(displayNames, keys.map((_, index) => `Команда ${index + 1}`));
  const uiBlob = JSON.stringify({
    teams: displayNames,
    conflicts: processed.conflicts,
    weekly: processed.weekly.map((week) => ({
      activeTeams: week.activeTeams,
      conflicts: week.conflicts,
    })),
  });
  for (const name of ['Монетизация', 'Домашний интернет', 'ДГП', 'МегаИнтернет', 'Тарифы']) {
    assert.equal(uiBlob.includes(name), false, `leaked team ${name}`);
  }
  assert.ok(processed.conflicts.every((conflict) =>
    conflict.teams.every((team) => /^Команда \d+$/.test(team))
  ));
});

test('anonymizeRoster drops person names', () => {
  const roster = JSON.parse(readFileSync(new URL('../roster.json', import.meta.url), 'utf8'));
  const anon = anonymizeRoster(roster);
  assert.ok(anon.people.length > 0);
  assert.ok(anon.people.every((person) => person.name === person.role));
  const blob = JSON.stringify(anon);
  assert.equal(/Антон|Егор|Настя|Папенко|Судариков|Фёдорова/.test(blob), false);
});
