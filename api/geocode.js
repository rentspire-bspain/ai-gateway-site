// ZIP5 geocoding worker — direct PostgreSQL connection with pg library
// Deployed to ai-gateway project, triggered repeatedly to close ZIP5 gaps
// Requires environment variables: PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, GEOCODE_WORKER_TOKEN
const { Pool } = require('pg');

const PG_CONFIG = {
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'RentSpireDataRepair/1.0 (data-quality@spaincos.com)';

// Global pool (reused across invocations in warm containers)
let pool = null;
function getPool() {
  if (!pool) {
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD) {
      throw new Error('Missing required environment variables: PG_HOST, PG_USER, PG_PASSWORD');
    }
    pool = new Pool(PG_CONFIG);
  }
  return pool;
}

// Helper: Geocode address using Nominatim
async function geocodeAddress(street, city, state) {
  const query = `${street}, ${city}, ${state}`;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=us`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const postcode = data[0]?.address?.postcode;
        if (postcode && postcode.length >= 5) {
          return postcode.substring(0, 5);
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Worker-Token');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Authentication
    const WORKER_TOKEN = process.env.GEOCODE_WORKER_TOKEN;
    const providedToken = req.headers['x-worker-token'] || req.query.token;

    if (!WORKER_TOKEN) {
      return res.status(500).json({ error: 'worker_token_not_configured' });
    }

    if (providedToken !== WORKER_TOKEN) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing worker token' });
    }

    const batchSize = parseInt(req.query.batch || '25', 10);

    // Get database connection
    const dbPool = getPool();
    const client = await dbPool.connect();

    try {
      // Get next batch of rows needing ZIP5
      const selectResult = await client.query(`
        SELECT property_id, clean_address_line1, clean_city, clean_state
        FROM geo.place_address
        WHERE clean_zip5 IS NULL
          AND clean_state IS NOT NULL
          AND clean_address_line1 IS NOT NULL
          AND clean_address_line1 != ''
          AND clean_city IS NOT NULL
          AND clean_city != ''
          AND COALESCE(zip5_source, '') NOT IN ('nominatim_geocode', 'nominatim_failed')
        ORDER BY property_id
        LIMIT $1
      `, [batchSize]);

      const rows = selectResult.rows;

      if (!rows || rows.length === 0) {
        const countResult = await client.query(`
          SELECT COUNT(*) as total FROM geo.place_address WHERE clean_zip5 IS NULL AND clean_state IS NOT NULL
        `);
        return res.status(200).json({
          status: 'complete',
          message: 'No more rows to geocode',
          processed: 0,
          remaining: countResult.rows[0].total
        });
      }

      let matched = 0;
      let failed = 0;
      const results = [];

      for (const row of rows) {
        // Validate address format
        if (!row.clean_address_line1 || !/^[0-9]+ /.test(row.clean_address_line1)) {
          await client.query(`
            UPDATE geo.place_address
            SET zip5_source = 'nominatim_failed', updated_at = now()
            WHERE property_id = $1 AND clean_zip5 IS NULL
          `, [row.property_id]);
          failed++;
          continue;
        }

        // Geocode
        const zip5 = await geocodeAddress(row.clean_address_line1, row.clean_city, row.clean_state);

        if (zip5) {
          await client.query(`
            UPDATE geo.place_address
            SET clean_zip5 = $1, zip5_source = 'nominatim_geocode', updated_at = now()
            WHERE property_id = $2 AND clean_zip5 IS NULL
          `, [zip5, row.property_id]);
          matched++;
          results.push({ property_id: row.property_id, zip5 });
        } else {
          await client.query(`
            UPDATE geo.place_address
            SET zip5_source = 'nominatim_failed', updated_at = now()
            WHERE property_id = $1 AND clean_zip5 IS NULL
          `, [row.property_id]);
          failed++;
        }

        // Rate limit: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get remaining count
      const remainingResult = await client.query(`
        SELECT COUNT(*) as total FROM geo.place_address
        WHERE clean_zip5 IS NULL
          AND clean_state IS NOT NULL
          AND clean_address_line1 IS NOT NULL
          AND clean_address_line1 != ''
          AND clean_city IS NOT NULL
          AND clean_city != ''
          AND COALESCE(zip5_source, '') NOT IN ('nominatim_geocode', 'nominatim_failed')
      `);
      const remaining = remainingResult.rows[0].total;

      return res.status(200).json({
        status: 'batch_complete',
        processed: rows.length,
        matched,
        failed,
        remaining,
        sample_results: results.slice(0, 5)
      });

    } finally {
      client.release();
    }

  } catch (error) {
    return res.status(500).json({
      error: 'internal_error',
      details: error.message
    });
  }
};
