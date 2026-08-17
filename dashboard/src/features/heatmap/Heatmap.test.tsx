/**
 * The heatmap's accessibility contract.
 *
 * These assert the properties that make the grid usable by someone who is not
 * looking at colour: a screen-reader user, a teacher printing in greyscale, a
 * colour-blind reader on a washed-out school projector. Each one is easy to
 * break with a styling change that looks harmless, which is why they are
 * tests rather than a note in the file header.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';

import { initI18n } from '../../i18n';
import { Heatmap } from './Heatmap';
import type { ClassSummary } from '../../data/queries';

const i18n = initI18n();

function summary(overrides: Partial<ClassSummary> = {}): ClassSummary {
  return {
    generatedAt: '2026-08-17T09:00:00.000Z',
    participation: { enrolled: 2, activeThisPeriod: 2, medianAttempts: 4, medianMinutes: 12 },
    heatmap: [
      {
        userId: 'u1',
        displayName: 'Rina',
        nodes: [
          { skillNodeId: 'algo.greedy', mastery: 0.88, band: 'mastered', evidenceCount: 6 },
          { skillNodeId: 'comp.counting', mastery: 0.42, band: 'emerging', evidenceCount: 1 },
        ],
      },
      {
        userId: 'u2',
        displayName: 'Yosef',
        nodes: [
          { skillNodeId: 'algo.greedy', mastery: 0.55, band: 'developing', evidenceCount: 3 },
        ],
      },
    ],
    gaps: [],
    unsyncedWarning: null,
    ...overrides,
  };
}

function renderHeatmap(data: ClassSummary, onSelect = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <Heatmap summary={data} onSelectStudent={onSelect} />
    </I18nextProvider>,
  );
  return onSelect;
}

describe('Heatmap', () => {
  it('is a real table, so it can be read and printed', () => {
    renderHeatmap(summary());
    // A canvas would satisfy the visual requirement and none of the others.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 students
  });

  it('names student, skill and band in every cell', () => {
    renderHeatmap(summary());
    // The colour is not the information; this text is.
    expect(screen.getByText(/Rina.*Menahan langkah menggoda.*Mahir/)).toBeInTheDocument();
  });

  it('carries a letter as well as a colour', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Heatmap summary={summary()} onSelectStudent={vi.fn()} />
      </I18nextProvider>,
    );
    // Greyscale print and colour-blind readers both depend on this.
    const cells = container.querySelectorAll('td');
    for (const cell of cells) {
      expect(cell.textContent?.replace(/\s/g, '').length).toBeGreaterThan(0);
    }
  });

  it('fills a missing node rather than shifting the row', () => {
    renderHeatmap(summary());
    const rows = screen.getAllByRole('row');
    const yosef = rows[2];
    // Yosef has evidence for one skill; the grid still has a cell for both, or
    // the columns would not line up with the header and every reading of the
    // grid after the first gap would be wrong.
    expect(within(yosef as HTMLElement).getAllByRole('cell')).toHaveLength(2);
  });

  it('marks a band built on a single piece of evidence', () => {
    renderHeatmap(summary());
    // One lucky mission and a fortnight of consistent work must not look
    // identical on a grid a teacher makes decisions from.
    expect(screen.getByText(/Rina.*Berhitung.*1 bukti/)).toBeInTheDocument();
  });

  it('opens a student when their name is activated', async () => {
    const onSelect = renderHeatmap(summary());
    screen.getByRole('button', { name: 'Rina' }).click();
    expect(onSelect).toHaveBeenCalledWith('u1');
  });

  it('says so plainly when the class is empty', () => {
    renderHeatmap(summary({ heatmap: [] }));
    expect(screen.getByText(/Belum ada siswa/)).toBeInTheDocument();
  });

  it('distinguishes "no students" from "no evidence yet"', () => {
    // A class that has just been created and one where nobody has played are
    // different situations with different next actions.
    renderHeatmap(
      summary({ heatmap: [{ userId: 'u1', displayName: 'Rina', nodes: [] }] }),
    );
    expect(screen.getByText(/Belum ada bukti/)).toBeInTheDocument();
  });
});
