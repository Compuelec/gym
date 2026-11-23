import base from './playwright.config';
import { defineConfig } from '@playwright/test';

// AI tests change global settings: run them alone, serially, in Chromium only.
export default defineConfig({ ...base, testMatch: /\.ai\.ts$/, fullyParallel: false, workers: 1, projects: [base.projects![0]!] });
