import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekCellLabel, isVacation } from '../process.js';

test('weekCellLabel follows MegaInternet 5G кино occupancy days', () => {
  assert.equal(weekCellLabel('2'), '2');
  assert.equal(weekCellLabel('5'), '5');
  assert.equal(weekCellLabel('4'), '4');
  assert.equal(weekCellLabel('1'), '1');
  assert.equal(weekCellLabel('отпуск'), 'отпуск');
  assert.equal(weekCellLabel('отпуск Лера'), 'отпуск');
  assert.equal(weekCellLabel('3 на ресайзы'), '3');
  assert.equal(weekCellLabel(''), '');
});

test('h2 5G кино cells store occupancy day counts', () => {
  const raw = JSON.parse(readFileSync(new URL('../data-h2-2026.json', import.meta.url), 'utf8'));
  const lera = raw.entries.find(
    (entry) => entry.team === 'МегаИнтернет' && entry.task === '5G кино' && entry.resource.includes('Лера')
  );
  assert.ok(lera);
  assert.equal(lera.weeks['2026-08-03'], '2');
  assert.equal(lera.weeks['2026-08-10'], '5');

  const fe = raw.entries.find(
    (entry) => entry.team === 'МегаИнтернет' && entry.task === '5G кино' && entry.role === 'FE'
  );
  assert.equal(fe.weeks['2026-08-17'], '5');

  const qa = raw.entries.find(
    (entry) => entry.team === 'МегаИнтернет' && entry.task === '5G кино' && entry.role === 'QA'
  );
  assert.equal(qa.weeks['2026-08-17'], 'отпуск');
  assert.equal(qa.weeks['2026-08-31'], '5');
});

test('h2 daily-plan cells use day counts instead of role labels', () => {
  const raw = JSON.parse(readFileSync(new URL('../data-h2-2026.json', import.meta.url), 'utf8'));
  const dux = raw.entries.find(
    (entry) => entry.team === 'ДИ' && entry.task.includes('FMC') && entry.role === 'Дизайн'
  );
  assert.ok(dux);
  for (const value of Object.values(dux.weeks)) {
    assert.ok(/^\d+$/.test(value) || isVacation(value), `unexpected cell ${value}`);
  }
  assert.ok(Object.values(dux.weeks).some((value) => Number(value) >= 2));
});
