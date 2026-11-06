// Configuración pública ficticia para las pruebas: nunca el tenant ni la API reales.
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
process.env.EXPO_PUBLIC_AUTH0_DOMAIN = 'tenant.example.test';
process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'test-client-id';
process.env.EXPO_PUBLIC_AUTH0_AUDIENCE = 'https://api.example.test';

// Mock oficial de AsyncStorage (memoria): las pruebas no tocan almacenamiento real.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
