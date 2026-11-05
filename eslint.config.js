// Configuración de ESLint (formato "flat" de ESLint 9).
const { defineConfig } = require('eslint/config');
// Reglas oficiales de Expo: React, hooks, imports y TypeScript.
const expoConfig = require('eslint-config-expo/flat');
// Ejecuta Prettier como regla y apaga las reglas de estilo que chocan con él.
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      // Nada de console.* en el código de la app: podría filtrar datos financieros al log del teléfono.
      'no-console': 'error',
      // Las variables sin uso suelen ser código muerto o errores; "_" permite ignorarlas a propósito.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Carpetas generadas que no se revisan.
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'coverage/*'],
  },
]);
