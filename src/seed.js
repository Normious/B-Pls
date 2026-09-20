import { getDatabase } from './db.js';

const db = getDatabase();

db.prepare(`
  INSERT OR IGNORE INTO projects 
  (name, api_key, default_sources, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`).run(
  'Shop A',
  'shop-a-bpls-key-2026',
  'food,beauty,pet,products,books',
  Date.now(), Date.now()
);

db.prepare(`
  INSERT OR IGNORE INTO projects 
  (name, api_key, default_sources, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`).run(
  'Gig4Gig',
  'gig4gig-bpls-key-2026',
  'products,books',
  Date.now(), Date.now()
);

console.log('✅ Seed data inserted');
