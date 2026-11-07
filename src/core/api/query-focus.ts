// En React Native no hay "foco de ventana": se le avisa a TanStack Query cuando la app vuelve al primer plano,
// y él recarga solo los datos vencidos (staleTime de 30 s). Patrón recomendado por TanStack para React Native.
import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

export function useRefetchOnAppFocus(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);
}
