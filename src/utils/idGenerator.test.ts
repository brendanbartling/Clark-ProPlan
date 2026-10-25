import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNextTaskId, normalizePrefix } from './idGenerator';
import { StickyNote, Trade } from '../types';

test('normalizePrefix strips dashes and special chars and upper-cases', () => {
  assert.equal(normalizePrefix('elec-'), 'ELEC');
  assert.equal(normalizePrefix('CONC'), 'CONC');
  assert.equal(normalizePrefix('   stl-01 '), 'STL01');
  assert.equal(normalizePrefix(''), 'ACT');
});

test('generateNextTaskId starts at 010 for fresh prefix', () => {
  const trade: Trade = {
    id: 'TRADE-ELEC',
    name: 'Electrical',
    code: 'E',
    idPrefix: 'ELEC',
    color: '#FFCD00',
    textColor: '#000000',
  };
  const tasks: StickyNote[] = [];
  const nextId = generateNextTaskId(trade, tasks);
  assert.equal(nextId, 'ELEC-010');
});

test('generateNextTaskId spaces out by 10 from existing tasks', () => {
  const trade: Trade = {
    id: 'TRADE-CONC',
    name: 'Concrete',
    code: 'CONC',
    idPrefix: 'CONC',
    color: '#702082',
    textColor: '#FFFFFF',
  };
  const tasks: StickyNote[] = [
    {
      id: 'CONC-010',
      name: 'Task 1',
      tradeId: 'TRADE-CONC',
      laneId: 'LANE-1',
      day: 1,
      duration: 2,
      crewSize: 4,
      shape: 'rectangle',
      status: 'planned',
    },
    {
      id: 'CONC-020',
      name: 'Task 2',
      tradeId: 'TRADE-CONC',
      laneId: 'LANE-1',
      day: 3,
      duration: 2,
      crewSize: 4,
      shape: 'rectangle',
      status: 'planned',
    },
  ];

  const nextId = generateNextTaskId(trade, tasks);
  assert.equal(nextId, 'CONC-030');
});
