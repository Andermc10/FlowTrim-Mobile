// Corre después de cargar Jest y Testing Library.
import { configure } from '@testing-library/react-native';

// findBy*/waitFor esperan hasta 5 s (1 s por defecto): en máquinas con poca RAM las primeras pruebas, que cargan todas
// las rutas, pueden tardar más. Solo afecta a las pruebas; si algo nunca aparece, la prueba igual falla.
configure({ asyncUtilTimeout: 5000 });

// renderRouter (expo-router/testing-library) activa los temporizadores falsos de Jest, y TanStack Query avisa a las
// pantallas con setTimeout(cb, 0): con el tiempo congelado los datos nunca llegarían. En pruebas los avisos van por
// una promesa resuelta (microtarea real, no congelada). En la app real no cambia nada.
import { notifyManager } from '@tanstack/react-query';

notifyManager.setScheduler((callback) => {
  void Promise.resolve().then(callback);
});
