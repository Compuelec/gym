// The AI settings are global (one row for the whole app): the admin (US7) and coach (US6) tests
// change them, so they live in one file that runs serially and never overlap.
import { test } from '../fixtures';

test.describe.configure({ mode: 'serial' });

import './us7-admin.ai';
import './us6-coach.ai';
