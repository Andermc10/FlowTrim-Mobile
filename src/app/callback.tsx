// Destino de flowtrim://callback al volver del login o logout de Auth0. El navegador ya entregó el resultado a
// expo-auth-session; esta ruta solo evita la pantalla "ruta no encontrada" y devuelve al inicio.
import { Redirect } from 'expo-router';

export default function CallbackRoute() {
  return <Redirect href="/" />;
}
