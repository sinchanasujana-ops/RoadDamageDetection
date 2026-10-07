import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DetectionRecord } from '../types/detection';

const STORAGE_KEY_RECORDS = 'road_damage_detections_records';
const STORAGE_KEY_CONFIG = 'road_damage_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function isValidHttpUrl(stringToTest?: string | null): boolean {
  if (!stringToTest || typeof stringToTest !== 'string') return false;
  const trimmed = stringToTest.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Initial realistic seed records for immediate inspection & demonstration
const INITIAL_SEED_RECORDS: DetectionRecord[] = [
  {
    id: 'seed-1',
    source_file: 'survey_sec_401_pothole.jpg',
    damage_type: 'pothole',
    confidence: 0.88,
    severity: 'High',
    severity_score: 0.12,
    x1: 180,
    y1: 140,
    x2: 360,
    y2: 290,
    img_width: 800,
    img_height: 600,
    location: 'District 4 - Highway 101 N',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'seed-2',
    source_file: 'survey_sec_401_pothole.jpg',
    damage_type: 'transverse crack',
    confidence: 0.74,
    severity: 'Medium',
    severity_score: 0.05,
    x1: 420,
    y1: 220,
    x2: 680,
    y2: 260,
    img_width: 800,
    img_height: 600,
    location: 'District 4 - Highway 101 N',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'seed-3',
    source_file: 'survey_sec_308_alligator.jpg',
    damage_type: 'alligator crack',
    confidence: 0.91,
    severity: 'High',
    severity_score: 0.19,
    x1: 95,
    y1: 120,
    x2: 540,
    y2: 430,
    img_width: 800,
    img_height: 600,
    location: 'Central Corridor - Main St',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'seed-4',
    source_file: 'survey_sec_205_longitudinal.jpg',
    damage_type: 'longitudinal crack',
    confidence: 0.82,
    severity: 'Medium',
    severity_score: 0.06,
    x1: 310,
    y1: 40,
    x2: 370,
    y2: 520,
    img_width: 800,
    img_height: 600,
    location: 'Harbor Blvd & 5th Ave',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'seed-5',
    source_file: 'survey_sec_102_pothole.jpg',
    damage_type: 'pothole',
    confidence: 0.69,
    severity: 'Low',
    severity_score: 0.03,
    x1: 230,
    y1: 310,
    x2: 310,
    y2: 375,
    img_width: 800,
    img_height: 600,
    location: 'Industrial Park Way',
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    id: 'seed-6',
    source_file: 'survey_sec_109_surface.jpg',
    damage_type: 'transverse crack',
    confidence: 0.79,
    severity: 'Low',
    severity_score: 0.04,
    x1: 140,
    y1: 280,
    x2: 450,
    y2: 310,
    img_width: 800,
    img_height: 600,
    location: 'Central Corridor - Main St',
    created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
  },
  {
    id: 'seed-7',
    source_file: 'survey_sec_512_fatigue.jpg',
    damage_type: 'alligator crack',
    confidence: 0.86,
    severity: 'High',
    severity_score: 0.15,
    x1: 210,
    y1: 160,
    x2: 600,
    y2: 480,
    img_width: 800,
    img_height: 600,
    location: 'District 4 - Highway 101 N',
    created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
];

export function getStoredConfig(): SupabaseConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey && isValidHttpUrl(parsed.url)) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
        };
      }
    }
  } catch {
    // ignore
  }

  return {
    url: envUrl,
    anonKey: envKey,
  };
}

export function saveStoredConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_CONFIG,
      JSON.stringify({ url: config.url.trim(), anonKey: config.anonKey.trim() })
    );
  } catch (e) {
    console.warn('Failed to save Supabase config to local storage', e);
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredConfig();
  if (!isValidHttpUrl(config.url) || !config.anonKey || !config.anonKey.trim()) {
    return null;
  }

  const trimmedUrl = config.url.trim();
  const trimmedKey = config.anonKey.trim();
  const key = `${trimmedUrl}::${trimmedKey}`;

  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(trimmedUrl, trimmedKey);
    cachedConfigKey = key;
    return cachedClient;
  } catch (err) {
    console.warn('Supabase client initialization skipped:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const config = getStoredConfig();
  return isValidHttpUrl(config.url) && Boolean(config.anonKey && config.anonKey.trim());
}

// Local cache functions
function getLocalRecords(): DetectionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read records from local storage', e);
  }
  // Initialize with seed
  saveLocalRecords(INITIAL_SEED_RECORDS);
  return INITIAL_SEED_RECORDS;
}

function saveLocalRecords(records: DetectionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to save records to local storage', e);
  }
}

/**
 * Save detection rows to Supabase table `detections`.
 * Columns required: source_file, damage_type, confidence, severity, severity_score, x1, y1, x2, y2, img_width, img_height, location, created_at
 */
export async function insertDetections(
  records: Omit<DetectionRecord, 'id'>[]
): Promise<{ success: boolean; insertedCount: number; error?: string; usedSupabase: boolean }> {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const payload = records.map((r) => ({
        source_file: r.source_file,
        damage_type: r.damage_type,
        confidence: Number(r.confidence),
        severity: r.severity,
        severity_score: Number(r.severity_score),
        x1: Number(r.x1),
        y1: Number(r.y1),
        x2: Number(r.x2),
        y2: Number(r.y2),
        img_width: Number(r.img_width),
        img_height: Number(r.img_height),
        location: r.location,
        created_at: r.created_at || new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('detections').insert(payload).select();

      if (error) {
        console.warn('Supabase insert notice, using local cache:', error.message);
        const local = getLocalRecords();
        const stamped = records.map((r, i) => ({
          ...r,
          id: `local-${Date.now()}-${i}`,
        }));
        saveLocalRecords([...stamped, ...local]);
        return {
          success: true,
          insertedCount: records.length,
          error: `Supabase: ${error.message} (cached locally)`,
          usedSupabase: false,
        };
      }

      // Also mirror locally for offline reliability
      const local = getLocalRecords();
      const stamped = (data && data.length > 0 ? data : records).map((r, i) => ({
        ...r,
        id: (r as any).id || `synced-${Date.now()}-${i}`,
      }));
      saveLocalRecords([...stamped, ...local]);

      return {
        success: true,
        insertedCount: records.length,
        usedSupabase: true,
      };
    } catch (err: any) {
      console.warn('Supabase connection note:', err);
      const local = getLocalRecords();
      const stamped = records.map((r, i) => ({
        ...r,
        id: `local-${Date.now()}-${i}`,
      }));
      saveLocalRecords([...stamped, ...local]);
      return {
        success: true,
        insertedCount: records.length,
        error: err.message || 'Supabase host unavailable (cached locally)',
        usedSupabase: false,
      };
    }
  }

  // Supabase not configured: save directly to local storage
  const local = getLocalRecords();
  const stamped = records.map((r, i) => ({
    ...r,
    id: `local-${Date.now()}-${i}`,
  }));
  saveLocalRecords([...stamped, ...local]);

  return {
    success: true,
    insertedCount: records.length,
    usedSupabase: false,
  };
}

/**
 * Fetch detections from Supabase `detections` table (or local storage fallback)
 */
export async function fetchDetections(): Promise<{
  records: DetectionRecord[];
  isLiveSupabase: boolean;
  error?: string;
}> {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('detections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.warn('Supabase query note:', error.message);
        return {
          records: getLocalRecords(),
          isLiveSupabase: false,
          error: error.message,
        };
      }

      if (data && data.length > 0) {
        saveLocalRecords(data);
        return {
          records: data,
          isLiveSupabase: true,
        };
      } else {
        return {
          records: [],
          isLiveSupabase: true,
        };
      }
    } catch (err: any) {
      console.warn('Supabase connection note:', err);
      return {
        records: getLocalRecords(),
        isLiveSupabase: false,
        error: err.message,
      };
    }
  }

  return {
    records: getLocalRecords(),
    isLiveSupabase: false,
  };
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const config = getStoredConfig();
  if (!isValidHttpUrl(config.url)) {
    return {
      ok: false,
      message: 'Please provide a valid HTTP or HTTPS Supabase Project URL (e.g. https://xyz.supabase.co).',
    };
  }
  if (!config.anonKey || !config.anonKey.trim()) {
    return { ok: false, message: 'Please provide a valid Supabase Anon Public Key.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Could not initialize client with provided parameters.' };
  }

  try {
    const { error } = await supabase
      .from('detections')
      .select('count', { count: 'exact', head: true });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Connection successful. Table "detections" reachable.' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Failed to reach Supabase endpoint' };
  }
}
