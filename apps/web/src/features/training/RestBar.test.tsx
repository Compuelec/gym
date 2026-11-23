import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RestBar } from './RestBar';

vi.mock('./device', () => ({ restFinishedFeedback: vi.fn(), scheduleRestPush: vi.fn(), cancelRestPush: vi.fn() }));
afterEach(cleanup);

describe('RestBar for screen readers', () => {
  it('does not read every tick of the countdown', () => {
    render(<RestBar rest={{ endsAt: Date.now() + 60_000, totalSeconds: 60 }} onAdd={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('timer').getAttribute('aria-live')).toBe('off');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('announces once when the rest is over', () => {
    render(<RestBar rest={{ endsAt: Date.now() - 1_000, totalSeconds: 60 }} onAdd={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('status').textContent).toMatch(/Descanso terminado/);
  });

  it('the «Siguiente» button stays readable on the green bar (dark text on its white background)', () => {
    render(<RestBar rest={{ endsAt: Date.now() - 1_000, totalSeconds: 60 }} onAdd={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('button', { name: 'Siguiente' }).className).toContain('text-foreground');
  });
});
