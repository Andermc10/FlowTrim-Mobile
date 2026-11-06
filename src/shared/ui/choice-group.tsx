// Grupo de opciones excluyentes (idioma, tema): accesible como radio group, no solo por color.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export function ChoiceGroup<T extends string>({
  label,
  choices,
  selected,
  onSelect,
}: {
  label: string;
  choices: readonly Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {choices.map((choice) => {
          const checked = choice.value === selected;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ checked }}
              onPress={() => onSelect(choice.value)}
              style={[
                styles.choice,
                {
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  // La opción elegida se distingue por borde, fondo Y peso del texto (no solo color).
                  borderWidth: checked ? 2 : 1,
                  borderColor: checked ? colors.primary : colors.border,
                  backgroundColor: checked ? colors.surfaceSoft : colors.surface,
                },
              ]}
            >
              <Text style={[typography.body, { color: colors.text, fontWeight: checked ? '700' : '400' }]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: { minHeight: minTouchTarget, justifyContent: 'center', flexGrow: 1, alignItems: 'center' },
});
