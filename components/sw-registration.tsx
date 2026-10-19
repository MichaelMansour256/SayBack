'use client';

import { useEffect } from 'react';

export function SWRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // eslint-disable-next-line no-console
          console.log('SayBack SW registered:', registration.scope);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.warn('SayBack SW registration failed:', error);
        });
    }
  }, []);

  return null;
}
