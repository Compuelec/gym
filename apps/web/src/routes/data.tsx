import { useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { deleteLocalData, getDB } from '@/db/database';
import { t } from '@/i18n';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useUser } from '@/lib/auth-context';
import { clearSessionCache } from '@/lib/session';
import { forgetSyncEngine, getSyncEngine, useOnline } from '@/lib/sync-client';

export const Route = createFileRoute('/data')({ component: DataPage });

function DataPage() {
  const user = useUser();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportData() {
    const res = await fetch('/api/me/export', { credentials: 'same-origin' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    setImportMsg(null);
    setImportErr(null);
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const { imported } = (await apiFetch('/me/import', { method: 'POST', body: JSON.stringify(json) })) as { imported: number };
      // Pull everything again so the new records appear on this device.
      await getDB(user.id).meta.put({ key: 'syncCursor', value: 0 });
      await getSyncEngine(user.id).sync();
      setImportMsg(t('data.imported', { count: imported }));
    } catch (err) {
      setImportErr(t('data.importFailed', { message: err instanceof ApiRequestError ? err.message : t('auth.errors.generic') }));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteAccount() {
    setDeleteErr(null);
    setBusy(true);
    try {
      await apiFetch('/me', { method: 'DELETE', body: JSON.stringify({ confirm, password }) });
      forgetSyncEngine(user.id);
      await deleteLocalData(user.id);
      clearSessionCache();
      location.assign('/login');
    } catch (err) {
      setDeleteErr(err instanceof ApiRequestError ? err.message : t('auth.errors.generic'));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">{t('data.title')}</h1>
      {!online && <FormError message={t('data.needOnline')} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('data.exportTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('data.exportText')}</p>
        <Button variant="outline" disabled={!online} onClick={() => void exportData()}>
          {t('data.exportButton')}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('data.importTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('data.importText')}</p>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('data.importButton')}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            disabled={!online || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
        </label>
        {importMsg && (
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
            {importMsg}
          </p>
        )}
        <FormError message={importErr} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-danger/40 p-4">
        <h2 className="text-lg font-semibold text-danger">{t('data.deleteTitle')}</h2>
        <p className="text-sm">{t('data.deleteText')}</p>
        <TextField label={t('data.typeDelete')} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
        <TextField label={t('data.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={deleteErr} />
        <Button variant="destructive" disabled={confirm !== 'BORRAR' || !online || busy} onClick={() => void deleteAccount()}>
          {t('data.deleteButton')}
        </Button>
      </section>
    </div>
  );
}
