import { getDatabase } from './db.js';
console.log('Running migrations...');
getDatabase();
console.log('✅ Migration complete');
