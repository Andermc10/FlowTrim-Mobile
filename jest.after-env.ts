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

// Cada prueba empieza con la red conectada y sin datos guardados: la copia local de la caché (HU-90) no debe pasar de
// una prueba a otra. Corre antes que los beforeEach de cada archivo, así que estos pueden sembrar datos encima.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setNetworkConnected } from '@/testing/network';

beforeEach(async () => {
  setNetworkConnected(true);
  await AsyncStorage.clear();
});
