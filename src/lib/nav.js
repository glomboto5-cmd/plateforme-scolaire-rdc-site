import { createNavigationContainerRef } from '@react-navigation/native';

// Permet d'ouvrir un écran depuis n'importe où (ex. appel entrant)
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}
