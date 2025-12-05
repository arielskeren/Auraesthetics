import { neon } from '@neondatabase/serverless';

// Get database URL from environment
function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('NEON_DATABASE_URL environment variable is not set');
  }
  return url;
}

// Initialize Neon client (lazy initialization)
let sql_query: ReturnType<typeof neon> | null = null;

// Get the SQL client - use template literals: sql`SELECT * FROM table WHERE id = ${id}`
export function getSqlClient() {
  if (!sql_query) {
    sql_query = neon(getDatabaseUrl());
  }
  return sql_query;
}

// Get a fresh SQL client that bypasses connection caching
// Use this for operations that need to see the most recent data
// Creates a NEW client instance each time with cache-busting fetch options
export function getFreshSqlClient() {
  // Create a new client instance each time to avoid stale connection cache
  // Using fetchOptions with cache: 'no-store' to bypass any HTTP caching
  return neon(getDatabaseUrl(), {
    fetchOptions: {
      cache: 'no-store',
    },
  });
}

// Export sql client directly for use with template literals
// Lazy initialization to avoid accessing env vars at module load time
let _sqlQuery: ReturnType<typeof neon> | null = null;
export const sql = {
  // Use like: sql.query`SELECT * FROM bookings WHERE id = ${id}`
  get query() {
    if (!_sqlQuery) {
      _sqlQuery = getSqlClient();
    }
    return _sqlQuery;
  },
};

// Test database connection
export async function testConnection() {
  try {
    const client = getSqlClient();
    const result = await client`SELECT NOW()`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Helper function to execute the schema setup
export async function setupDatabase() {
  try {
    // This would be called from a setup script
    // For now, we'll run the SQL file manually in Neon dashboard
    console.log('Please run the SQL file in Neon dashboard SQL editor');
  } catch (error) {
    console.error('Database setup error:', error);
    throw error;
  }
}
