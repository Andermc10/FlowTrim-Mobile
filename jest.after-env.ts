// Corre después de cargar Jest y Testing Library.
import { configure } from '@testing-library/react-native';

// findBy*/waitFor esperan hasta 5 s (1 s por defecto): en máquinas con poca RAM las primeras pruebas, que cargan todas
// las rutas, pueden tardar más. Solo afecta a las pruebas; si algo nunca aparece, la prueba igual falla.
configure({ asyncUtilTimeout: 5000 });
