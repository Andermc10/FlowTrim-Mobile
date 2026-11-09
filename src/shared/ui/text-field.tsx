// Campo de texto con etiqueta visible, ayuda opcional y errores; zona táctil ≥ 44 dp.
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';

import { FieldError } from './field-error';

export interface TextFieldProps extends Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'keyboardType' | 'maxLength' | 'placeholder' | 'autoFocus' | 'returnKeyType'
> {
  label: string;
  hint?: string;
  errors?: readonly string[];
}

export function TextField({ label, hint, errors = [], ...input }: TextFieldProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const invalid = errors.length > 0;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.caption, { color: colors.muted }]}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={hint}
        // El error se marca con borde Y con el texto de FieldError (no solo con color).
        aria-invalid={invalid}
        placeholderTextColor={colors.muted}
        style={[
          typography.body,
          {
            minHeight: minTouchTarget,
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: invalid ? colors.danger : colors.borderStrong,
            borderWidth: invalid ? 2 : 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      {hint ? <Text style={[typography.caption, { color: colors.muted }]}>{hint}</Text> : null}
      <FieldError messages={errors} />
    </View>
  );
}
