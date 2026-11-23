import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import type { LocalLocation } from '@/lib/repos';
import { EquipmentPicker } from './EquipmentPicker';

export function LocationEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: LocalLocation;
  onSave: (l: LocalLocation) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary p-4">
      <TextField label={t('profile.locationName')} value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <EquipmentPicker label={t('profile.equipment')} value={draft.equipment} onChange={(equipment) => setDraft({ ...draft, equipment })} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void onSave({ ...draft, name: draft.name.trim() })} disabled={!draft.name.trim()}>
          {t('common.save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
