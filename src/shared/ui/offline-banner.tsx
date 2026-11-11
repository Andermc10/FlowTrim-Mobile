// Avisos sin conexión (HU-90): la pantalla muestra la copia local con su hora, y los formularios no guardan.
import { Text, View } from 'react-native';

import { localeFor } from '@/core/format/money';
import { useI18n } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/translations';
import { useOnline } from '@/core/network/network-status';
import { useTheme } from '@/core/theme/theme';

/** "Nov 6, 10:42 AM" / "6 nov, 10:42 a. m." en la hora del teléfono: cuándo se cargaron los datos que se ven. */
export function formatUpdatedAt(updatedAt: number, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updatedAt));
}

/** Franja visible solo sin conexión. `updatedAt` es la hora de los datos mostrados (0 si no hay copia). */
export function OfflineBanner({ updatedAt }: { updatedAt: number }) {
  const { colors, radius, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const online = useOnline();
  if (online) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        borderColor: colors.warning,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
        {updatedAt > 0
          ? t('offline.banner', { time: formatUpdatedAt(updatedAt, language) })
          : t('offline.bannerNoTime')}
      </Text>
      <Text style={[typography.caption, { color: colors.muted }]}>{t('offline.readOnly')}</Text>
    </View>
  );
}

/** En un formulario sin conexión: explica por qué no se puede guardar (FR-2). */
export function OfflineSaveNotice() {
  const { colors, typography } = useTheme();
  const { t } = useI18n();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[typography.body, { color: colors.warning, fontWeight: '600' }]}
    >
      {`! ${t('offline.cannotSave')}`}
    </Text>
  );
}
