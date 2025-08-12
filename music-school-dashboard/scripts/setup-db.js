// Database setup script for Vercel deployment
// This can be run once after deployment to initialize the database

import { initializeDatabase } from './lib/vercel-db.js';

async function setupDatabase() {
  try {
    console.log('Setting up Vercel database...');
    await initializeDatabase();
    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
