import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import { config } from '../config/env.js';

let client = null;

export function getSupabase() {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket },
    });
  }
  return client;
}
