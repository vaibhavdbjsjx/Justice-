/**
 * Database types mirroring supabase/migrations. Hand-maintained for now; can be
 * regenerated later with `supabase gen types typescript`. Keep in sync with the
 * migration when the schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "consumer" | "lawyer";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type MatterStatus = "active" | "resolved" | "archived";
export type MessageRole = "user" | "assistant";
export type DocumentType = "uploaded" | "generated";
export type DeadlineStatus = "upcoming" | "completed" | "missed";
export type LinkStatus = "invited" | "active" | "ended";
export type SubscriptionTier = "free" | "plus" | "professional";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          role: UserRole;
          full_name: string | null;
          country: string | null;
          state_province: string | null;
          preferred_language: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role?: UserRole;
          full_name?: string | null;
          country?: string | null;
          state_province?: string | null;
          preferred_language?: string;
          onboarding_completed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      lawyer_profiles: {
        Row: {
          user_id: string;
          practice_areas: Json;
          licensed_jurisdictions: Json;
          bar_number: string | null;
          verification_status: VerificationStatus;
          rate_range: string | null;
          bio: string | null;
          rating_avg: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          practice_areas?: Json;
          licensed_jurisdictions?: Json;
          bar_number?: string | null;
          verification_status?: VerificationStatus;
          rate_range?: string | null;
          bio?: string | null;
          rating_avg?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_profiles"]["Insert"]>;
        Relationships: [];
      };
      matters: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category: string | null;
          jurisdiction_country: string | null;
          jurisdiction_state: string | null;
          status: MatterStatus;
          assigned_lawyer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category?: string | null;
          jurisdiction_country?: string | null;
          jurisdiction_state?: string | null;
          status?: MatterStatus;
          assigned_lawyer_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["matters"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          matter_id: string;
          user_id: string;
          role: MessageRole;
          content: string;
          citations: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          matter_id: string;
          user_id: string;
          role: MessageRole;
          content: string;
          citations?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          matter_id: string;
          uploaded_by: string;
          type: DocumentType;
          title: string | null;
          file_url: string | null;
          extracted_text: string | null;
          ai_annotations: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          matter_id: string;
          uploaded_by: string;
          type: DocumentType;
          title?: string | null;
          file_url?: string | null;
          extracted_text?: string | null;
          ai_annotations?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      deadlines: {
        Row: {
          id: string;
          matter_id: string;
          title: string;
          due_date: string | null;
          status: DeadlineStatus;
          reminder_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          matter_id: string;
          title: string;
          due_date?: string | null;
          status?: DeadlineStatus;
          reminder_sent?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["deadlines"]["Insert"]>;
        Relationships: [];
      };
      lawyer_client_links: {
        Row: {
          lawyer_id: string;
          client_id: string;
          matter_id: string;
          status: LinkStatus;
          created_at: string;
        };
        Insert: {
          lawyer_id: string;
          client_id: string;
          matter_id: string;
          status?: LinkStatus;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_client_links"]["Insert"]>;
        Relationships: [];
      };
      intake_links: {
        Row: {
          id: string;
          lawyer_id: string;
          token: string;
          label: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lawyer_id: string;
          token?: string;
          label?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["intake_links"]["Insert"]>;
        Relationships: [];
      };
      client_messages: {
        // Append-only (no UPDATE/DELETE grant — the communication log
        // cannot be rewritten by anyone).
        Row: {
          id: string;
          matter_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          matter_id: string;
          sender_id: string;
          body: string;
        };
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          tier: SubscriptionTier;
          status: string;
          renews_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          tier?: SubscriptionTier;
          status?: string;
          renews_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_access_matter: { Args: { m: string }; Returns: boolean };
      is_matter_owner: { Args: { m: string }; Returns: boolean };
      is_matter_lawyer: { Args: { m: string }; Returns: boolean };
      is_verified_lawyer: { Args: { uid: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience row aliases used across the app.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type LawyerProfile = Database["public"]["Tables"]["lawyer_profiles"]["Row"];
export type Matter = Database["public"]["Tables"]["matters"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type Deadline = Database["public"]["Tables"]["deadlines"]["Row"];
export type LawyerClientLink = Database["public"]["Tables"]["lawyer_client_links"]["Row"];
export type IntakeLink = Database["public"]["Tables"]["intake_links"]["Row"];
export type ClientMessage = Database["public"]["Tables"]["client_messages"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
