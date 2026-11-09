// Mantiene los recordatorios al día (HU-89 FR-2): tras cada carga correcta de los próximos cobros se reemplazan todos.
// Marcar un pago como pagado invalida esa consulta, así que sus recordatorios desaparecen al recargarse.
// También ofrece activarlos una sola vez, después de la primera carga con pagos (FR-1).
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useI18n } from '@/core/i18n/i18n';
import { useReminders } from '@/core/reminders/reminders';

import { useUpcomingCharges } from './use-payments';

export function ReminderSync() {
  const { t } = useI18n();
  const reminders = useReminders();
  const upcoming = useUpcomingCharges();
  const { schedule, offerPending, dismissOffer, setEnabled } = reminders;
  const items = upcoming.data?.items;

  useEffect(() => {
    if (items) {
      void schedule(items);
    }
  }, [items, schedule]);

  useEffect(() => {
    if (!offerPending || !items || items.length === 0) return;
    dismissOffer();
    Alert.alert(t('reminders.offer.title'), t('reminders.offer.message'), [
      { text: t('reminders.offer.later'), style: 'cancel' },
      { text: t('reminders.offer.enable'), onPress: () => void setEnabled(true) },
    ]);
  }, [offerPending, items, dismissOffer, setEnabled, t]);

  return null;
}
