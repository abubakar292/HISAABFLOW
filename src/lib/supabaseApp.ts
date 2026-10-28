export interface FirebaseApp {
  name: string;
  options: Record<string, any>;
}

const apps: FirebaseApp[] = [];

export function initializeApp(options: Record<string, any> = {}, name = '[DEFAULT]'): FirebaseApp {
  const existing = apps.find((a) => a.name === name);
  if (existing) return existing;
  const app: FirebaseApp = { name, options };
  apps.push(app);
  return app;
}

export function getApps(): FirebaseApp[] {
  return apps;
}

export function getApp(name = '[DEFAULT]'): FirebaseApp {
  const existing = apps.find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp({}, name);
}
