// API simulada para pruebas de pantallas: reemplaza fetch y responde por ruta, sin red ni backend.
import type { TodayDashboard } from '@/features/today/today-view';

export type FakeRoute = { status?: number; body?: unknown; headers?: Record<string, string> };

export function emptyToday(referenceDate = '2026-11-06'): TodayDashboard {
  return {
    referenceDate,
    currencies: [],
    accounts: [],
    recentTransactions: [],
    chargesUntilMonthEnd: [],
    budgetsToWatch: [],
  };
}

// Instala un fetch falso: cada clave es "MÉTODO /ruta" (sin query) y devuelve su respuesta; lo demás es 404.
export function installFakeApi(routes: Record<string, FakeRoute | (() => FakeRoute)>) {
  const calls: Request[] = [];
  const fetchMock = jest.fn(async (input: Request) => {
    calls.push(input);
    const url = new URL(input.url);
    const route = routes[`${input.method} ${url.pathname}`];
    const answer = typeof route === 'function' ? route() : route;
    if (!answer) {
      return new Response(null, { status: 404 });
    }
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...answer.headers },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}
