// Ruta de la pestaña: solo conecta la URL con la pantalla (la lógica vive en src/features).
import { useI18n } from '@/core/i18n/i18n';
import { PlaceholderScreen } from '@/shared/ui/placeholder-screen';

export default function PlanRoute() {
  const { t } = useI18n();
  return <PlaceholderScreen title={t('plan.title')} message={t('plan.placeholder')} />;
}
