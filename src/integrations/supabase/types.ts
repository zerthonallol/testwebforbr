export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          announcement: string | null
          announcement_by: number | null
          announcement_id: string | null
          case_overrides: Json
          id: number
          maintenance: boolean
          maintenance_text: string | null
          price_overrides: Json
          updated_at: string
        }
        Insert: {
          announcement?: string | null
          announcement_by?: number | null
          announcement_id?: string | null
          case_overrides?: Json
          id?: number
          maintenance?: boolean
          maintenance_text?: string | null
          price_overrides?: Json
          updated_at?: string
        }
        Update: {
          announcement?: string | null
          announcement_by?: number | null
          announcement_id?: string | null
          case_overrides?: Json
          id?: number
          maintenance?: boolean
          maintenance_text?: string | null
          price_overrides?: Json
          updated_at?: string
        }
        Relationships: []
      }
      live_drops: {
        Row: {
          brainrot_id: string
          created_at: string
          id: number
          source: string
          tg_id: number
          user_name: string
        }
        Insert: {
          brainrot_id: string
          created_at?: string
          id?: never
          source: string
          tg_id: number
          user_name: string
        }
        Update: {
          brainrot_id?: string
          created_at?: string
          id?: never
          source?: string
          tg_id?: number
          user_name?: string
        }
        Relationships: []
      }
      pending_grants: {
        Row: {
          amount: number
          brainrot_id: string | null
          case_id: string | null
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          tg_id: number
        }
        Insert: {
          amount?: number
          brainrot_id?: string | null
          case_id?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          tg_id: number
        }
        Update: {
          amount?: number
          brainrot_id?: string | null
          case_id?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          tg_id?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          first_name: string
          state: Json
          tg_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string
          state?: Json
          tg_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string
          state?: Json
          tg_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          coins: number
          created_at: string
          max_uses: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          coins: number
          created_at?: string
          max_uses?: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          coins?: number
          created_at?: string
          max_uses?: number
          uses?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          created_at: string
          tg_id: number
        }
        Insert: {
          code: string
          created_at?: string
          tg_id: number
        }
        Update: {
          code?: string
          created_at?: string
          tg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          admin_reply: string | null
          brainrot_id: string
          client_id: string
          created_at: string
          credit_as: string | null
          id: string
          resolved_at: string | null
          roblox_nick: string
          status: string
          tg_id: number
          type: string
          user_name: string
        }
        Insert: {
          admin_reply?: string | null
          brainrot_id: string
          client_id: string
          created_at?: string
          credit_as?: string | null
          id?: string
          resolved_at?: string | null
          roblox_nick: string
          status?: string
          tg_id: number
          type: string
          user_name?: string
        }
        Update: {
          admin_reply?: string | null
          brainrot_id?: string
          client_id?: string
          created_at?: string
          credit_as?: string | null
          id?: string
          resolved_at?: string | null
          roblox_nick?: string
          status?: string
          tg_id?: number
          type?: string
          user_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      redeem_promo: { Args: { _code: string; _tg_id: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
