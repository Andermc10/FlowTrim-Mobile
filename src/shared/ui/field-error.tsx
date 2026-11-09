// Mensajes de error de un campo (del teléfono o de la API): texto visible con "!" y anunciado por TalkBack.
import { Text, View } from 'react-native';

import { useTheme } from '@/core/theme/theme';

export function FieldError({ messages }: { messages: readonly string[] }) {
  const { colors, typography } = useTheme();
  if (messages.length === 0) {
    return null;
  }
  return (
    <View accessibilityLiveRegion="polite">
      {messages.map((message) => (
        <Text key={message} style={[typography.caption, { color: colors.danger, fontWeight: '600' }]}>
          {`! ${message}`}
        </Text>
      ))}
    </View>
  );
}
