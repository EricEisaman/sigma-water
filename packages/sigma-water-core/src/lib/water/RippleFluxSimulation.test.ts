import { describe, expect, test } from 'vitest';
import { RippleFluxSimulation } from './RippleFluxSimulation';

describe('RippleFluxSimulation', () => {
  test('propagates a disturbance over time', () => {
    const simulation = new RippleFluxSimulation(null, {
      resolution: 32,
      domainSize: 32,
    });

    simulation.disturbWorld(0, 0, 2, -0.8);
    simulation.update(1 / 60);
    const center = simulation.sampleWorld(0, 0, 1).height;
    simulation.update(1 / 60);
    const nearby = simulation.sampleWorld(1, 0, 1).height;

    expect(Math.abs(center)).toBeGreaterThan(0);
    expect(Math.abs(nearby)).toBeGreaterThan(0);

    simulation.dispose();
  });

  test('returns flat samples outside the simulation domain', () => {
    const simulation = new RippleFluxSimulation(null, {
      resolution: 32,
      domainSize: 32,
    });

    const sample = simulation.sampleWorld(100, 100, 1);
    expect(sample.height).toBe(0);
    expect(sample.normal.y).toBeCloseTo(1, 5);

    simulation.dispose();
  });
});
