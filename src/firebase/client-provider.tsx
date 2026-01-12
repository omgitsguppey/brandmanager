'use client';

import { ReactNode } from 'react';
import { app, auth, firestore, storage } from './client';
import { FirebaseProvider } from './provider';

export function ClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider
      firebaseApp={app}
      auth={auth}
      firestore={firestore}
      storage={storage}
    >
      {children}
    </FirebaseProvider>
  );
}