// Configuración pública ficticia para las pruebas: nunca el tenant ni la API reales.
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
process.env.EXPO_PUBLIC_AUTH0_DOMAIN = 'tenant.example.test';
process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'test-client-id';
process.env.EXPO_PUBLIC_AUTH0_AUDIENCE = 'https://api.example.test';

// Mock oficial de AsyncStorage (memoria): las pruebas no tocan almacenamiento real.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Recordatorios: ninguna prueba toca notificaciones reales. Cada archivo recibe un teléfono simulado nuevo;
// las pruebas que lo necesitan lo leen con jest.requireMock('@/core/reminders/reminder-device').
jest.mock('@/core/reminders/reminder-device', () => ({
  nativeReminderDevice: require('@/testing/test-doubles').createFakeReminderDevice(),
}));

// Red simulada: conectada por defecto; las pruebas sin conexion usan setNetworkConnected de src/testing/network.
jest.mock('@react-native-community/netinfo', () => require('@/testing/network').fakeNetInfoModule);
