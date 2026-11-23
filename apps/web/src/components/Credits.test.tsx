import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Credits } from './Credits';

afterEach(cleanup);

describe('Credits', () => {
  it('shows the released version (root package.json) and who made the app', () => {
    const root = [
      resolve(process.cwd(), 'package.json'),
      resolve(process.cwd(), '../../package.json'),
    ]
      .map((f) => {
        try {
          return JSON.parse(readFileSync(f, 'utf8')) as { name: string; version: string };
        } catch {
          return null;
        }
      })
      .find((p) => p?.name === 'gym')!;
    const { version } = root;
    render(<Credits />);
    expect(screen.getByText(`v${version}`)).toBeTruthy();
    expect(screen.getByText('Creado y diseñado por')).toBeTruthy();
    expect(screen.getByText('Compuelec Soporte')).toBeTruthy();
    expect(
      screen.getByText(`© ${new Date().getFullYear()} · Todos los derechos reservados`),
    ).toBeTruthy();
  });
});
