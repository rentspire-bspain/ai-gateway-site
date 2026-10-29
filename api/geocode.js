// Vercel serverless function: processes a batch of Nominatim ZIP5 geocoding
// Deployed to ai-gateway project, triggered repeatedly to close ZIP5 gaps
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dcyjmftriqayqaonitlx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeWptZnRyaXFheXFvbml0bHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTY4Nzk1OSwiZXhwIjoyMDk1MjYzOTU5OX0.ycGQ1gqFNJupCoUchWBfWVJOKPp-w94w2eyYAZNPBsI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const HEADERS = { 'User-Agent': 'RentSpireDataRepair/1.0 (data-quality@spaincos.com)' };

module.exports = async (req, res) => {
  try {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Worker-Token');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Authentication: require worker token
    const WORKER_TOKEN = process.env.GEOCODE_WORKER_TOKEN;
    const providedToken = req.headers['x-worker-token'] || req.query.token;

    if (!WORKER_TOKEN) {
      return res.status(500).json({ error: 'worker_token_not_configured' });
    }

    if (providedToken !== WORKER_TOKEN) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing worker token' });
    }

    const batchSize = parseInt(req.query.batch || req.body?.batch || '25', 10);
    const useServiceRole = !!SUPABASE_SERVICE_KEY;

    // Connect to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_KEY, {
      global: { headers: { 'x-supabase-role': useServiceRole ? 'service_role' : 'anon' } }
    });

    // Get next batch of rows needing ZIP5
    const { data: rows, error: fetchError } = await supabase
      .from('geo.place_address')
      .select('property_id, clean_address_line1, clean_city, clean_state')
      .is('clean_zip5', null)
      .not('clean_state', 'is', null)
      .not('clean_address_line1', 'is', null)
      .neq('clean_address_line1', '')
      .not('clean_city', 'is', null)
      .neq('clean_city', '')
      .order('property_id')
      .limit(batchSize);

    if (fetchError) {
      return res.status(500).json({ error: 'fetch_failed', details: fetchError.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        status: 'complete',
        message: 'No more rows to geocode',
        processed: 0
      });
    }

    let matched = 0;
    let failed = 0;
    const results = [];

    for (const row of rows) {
      // Validate address format
      if (!row.clean_address_line1 || !/^[0-9]+ /.test(row.clean_address_line1)) {
        // Mark as failed to skip
        await supabase
          .from('geo.place_address')
          .update({ zip5_source: 'nominatim_failed', updated_at: new Date().toISOString() })
          .eq('property_id', row.property_id)
          .is('clean_zip5', null);
        failed++;
        continue;
      }

      // Geocode using Nominatim
      const query = `${row.clean_address_line1}, ${row.clean_city}, ${row.clean_state}`;
      
      try {
        const response = await fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=us`, {
          headers: HEADERS,
          timeout: 10000
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const postcode = data[0]?.address?.postcode;
            if (postcode && postcode.length >= 5) {
              // Update with ZIP5
              const { error: updateError } = await supabase
                .from('geo.place_address')
                .update({
                  clean_zip5: postcode.substring(0, 5),
                  zip5_source: 'nominatim_geocode',
                  updated_at: new Date().toISOString()
                })
                .eq('property_id', row.property_id)
                .is('clean_zip5', null);

              if (!updateError) {
                matched++;
                results.push({ property_id: row.property_id, zip5: postcode.substring(0, 5) });
                continue;
              }
            }
          }
        }
      } catch (e) {
        // Geocoding failed
      }

      // Mark as failed
      await supabase
        .from('geo.place_address')
        .update({ zip5_source: 'nominatim_failed', updated_at: new Date().toISOString() })
        .eq('property_id', row.property_id)
        .is('clean_zip5', null);
      failed++;

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get remaining count
    const { count: remaining } = await supabase
      .from('geo.place_address')
      .select('*', { count: 'exact', head: true })
      .is('clean_zip5', null)
      .not('clean_state', 'is', null);

    return res.status(200).json({
      status: 'batch_complete',
      processed: rows.length,
      matched,
      failed,
      remaining: remaining || 0,
      results: results.slice(0, 10) // Sample results
    });

  } catch (error) {
    return res.status(500).json({
      error: 'internal_error',
      details: error.message
    });
  }
};
