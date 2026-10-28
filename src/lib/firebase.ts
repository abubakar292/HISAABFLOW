import { initializeApp } from './supabaseApp';
import { auth } from './supabaseAuth';
import { getFirestore } from './supabaseDb';

const app = initializeApp({
  provider: 'supabase',
  projectRef: 'ooneazyrjvxqztqmlpad',
});

export const db = getFirestore(app);
export { auth };
export default app;


