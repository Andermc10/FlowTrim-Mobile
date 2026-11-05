// Prueba de navegación sobre las rutas reales de src/app (AC-1 de HU-81).
// Vive fuera de src/app porque allí cada archivo se convierte en una pantalla.
import { getLocales } from 'expo-localization';
import { renderRouter, screen } from 'expo-router/testing-library';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockedGetLocales = getLocales as jest.Mock;

function deviceLanguage(languageCode: string) {
  mockedGetLocales.mockReturnValue([{ languageCode }]);
}

describe('tab navigation', () => {
  it('rootRoute_EnglishDevice_ShowsFourTabsAndToday', async () => {
    deviceLanguage('en');

    await renderRouter('./src/app', { initialUrl: '/' });

    for (const label of ['Today', 'Movements', 'Payments', 'Plan']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Your safe-to-spend estimate will appear here.')).toBeOnTheScreen();
  });

  it('paymentsRoute_SpanishDevice_ShowsSpanishTexts', async () => {
    deviceLanguage('es');

    await renderRouter('./src/app', { initialUrl: '/payments' });

    expect(screen.getByRole('header', { name: 'Pagos recurrentes' })).toBeOnTheScreen();
    expect(screen.getAllByText('Movimientos').length).toBeGreaterThan(0);
  });
});
