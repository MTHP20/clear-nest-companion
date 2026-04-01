import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPA_URL as string;
const key = import.meta.env.VITE_SUPA_KEY as string;

export const supabase = createClient(url, key);
