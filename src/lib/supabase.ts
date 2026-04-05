import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPA_URL as string;
const key = import.meta.env.VITE_SUPA_KEY as string;

// ─── Database type definitions ────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          conversation_id: string;
          family_id: string;
          transcript: string;
          transcript_turns: Array<{ role: 'user' | 'agent'; message: string; time_in_call_secs?: number }>;
          call_summary_title: string | null;
          transcript_summary: string | null;
          message_count: number;
          duration_seconds: number;
          topics_covered: string[];
          summary: string | null;
          source: 'voice' | 'manual' | 'import';
          status: 'active' | 'completed' | 'failed';
          started_at: string | null;
          ended_at: string | null;
          is_pinned: boolean;
          pinned_sections: Array<{ label: string; excerpt: string; turn_indices: number[]; pinned_at: string }>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
      };

      extracted_data: {
        Row: {
          id: string;
          item_id: string | null;
          family_id: string;
          session_id: string | null;
          category: string;
          field_name: string | null;
          value_json: Record<string, unknown>;
          confidence: number;
          source_type: 'elevenlabs_live' | 'claude_postprocess' | 'fallback_keyword' | 'manual';
          source_excerpt: string | null;
          needs_review: boolean;
          verification_status: 'unverified' | 'verified' | 'disputed';
          verified_by_role: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['extracted_data']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['extracted_data']['Insert']>;
      };

      user_assets: {
        Row: {
          id: string;
          family_id: string;
          bank_accounts: Array<{ content: string; confidence: string; source_excerpt?: string; captured_at: string }>;
          financial_accounts: Array<{ content: string; confidence: string; source_excerpt?: string; captured_at: string }>;
          property_details: Array<{ content: string; confidence: string; source_excerpt?: string; captured_at: string }>;
          pension_status: Record<string, unknown>;
          lpa_confirmed: Record<string, unknown>;
          will_location: Record<string, unknown>;
          key_contacts: Array<{ content: string; confidence: string; source_excerpt?: string; captured_at: string }>;
          care_wishes: Array<{ content: string; confidence: string; source_excerpt?: string; captured_at: string }>;
          completion_score: number;
          readiness_history: Array<{ date: string; score: number }>;
          last_session_id: string | null;
          last_updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_assets']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['user_assets']['Insert']>;
      };

      profiles: {
        Row: {
          id: string;
          family_id: string;
          bank_accounts: unknown[];
          financial_accounts: unknown[];
          property_details: unknown[];
          pension_status: string | null;
          lpa_confirmed: boolean;
          will_location: string | null;
          key_contacts: unknown[];
          care_wishes: string | null;
          last_updated: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
    };
  };
}

export const supabase = createClient<Database>(url, key);
