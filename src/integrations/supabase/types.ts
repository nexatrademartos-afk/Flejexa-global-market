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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      wallets: {
  Row: {
    created_at: string
    currency: string
    id: string
    status: string
    updated_at: string
    user_id: string
    wallet_number: string
  }
  Insert: {
    created_at?: string
    currency?: string
    id?: string
    status?: string
    updated_at?: string
    user_id: string
    wallet_number?: string
  }
  Update: {
    created_at?: string
    currency?: string
    id?: string
    status?: string
    updated_at?: string
    user_id?: string
    wallet_number?: string
  }
  Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          city: string
          country_iso2: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          phone: string
          postal_code: string | null
          province: string | null
          recipient: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country_iso2?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone: string
          postal_code?: string | null
          province?: string | null
          recipient: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country_iso2?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string
          postal_code?: string | null
          province?: string | null
          recipient?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nexa_accounts: {
        Row: {
          account_code: string
          account_number: number
          created_at: string
          user_id: string
        }
        Insert: {
          account_code: string
          account_number: number
          created_at?: string
          user_id: string
        }
        Update: {
          account_code?: string
          account_number?: number
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nexa_id_sequences: {
        Row: {
          identity_type: string
          last_value: number
          updated_at: string
        }
        Insert: {
          identity_type: string
          last_value?: number
          updated_at?: string
        }
        Update: {
          identity_type?: string
          last_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      nexa_identities: {
        Row: {
          country_iso2: string | null
          id: string
          identity_code: string
          identity_type: string
          issued_at: string
          metadata: Json
          retired_at: string | null
          sequence_number: number | null
          status: string
          user_id: string
        }
        Insert: {
          country_iso2?: string | null
          id?: string
          identity_code: string
          identity_type: string
          issued_at?: string
          metadata?: Json
          retired_at?: string | null
          sequence_number?: number | null
          status?: string
          user_id: string
        }
        Update: {
          country_iso2?: string | null
          id?: string
          identity_code?: string
          identity_type?: string
          issued_at?: string
          metadata?: Json
          retired_at?: string | null
          sequence_number?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      nexa_identity_aliases: {
        Row: {
          alias_code: string
          alias_source: string
          created_at: string
          id: string
          identity_id: string
        }
        Insert: {
          alias_code: string
          alias_source?: string
          created_at?: string
          id?: string
          identity_id: string
        }
        Update: {
          alias_code?: string
          alias_source?: string
          created_at?: string
          id?: string
          identity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexa_identity_aliases_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "nexa_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      nexa_identity_announcement_events: {
        Row: {
          banner_shown: boolean
          created_at: string
          display_number: number
          id: string
          login_event_id: string
          user_id: string
        }
        Insert: {
          banner_shown: boolean
          created_at?: string
          display_number: number
          id?: string
          login_event_id: string
          user_id: string
        }
        Update: {
          banner_shown?: boolean
          created_at?: string
          display_number?: number
          id?: string
          login_event_id?: string
          user_id?: string
        }
        Relationships: []
      }
      nexa_identity_announcements: {
        Row: {
          completed_at: string | null
          created_at: string
          display_count: number
          max_displays: number
          new_identity_code: string
          old_identity_code: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          display_count?: number
          max_displays?: number
          new_identity_code: string
          old_identity_code?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          display_count?: number
          max_displays?: number
          new_identity_code?: string
          old_identity_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          meta: Json | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          meta?: Json | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          meta?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          items: Json
          notes: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          source: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          source?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          source?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          colours: Json
          compare_at_price: number | null
          created_at: string
          delivery_info: string | null
          description: string | null
          discount_pct: number | null
          gallery: Json | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          sizes: Json
          sku: string | null
          slug: string
          specifications: Json
          stock: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          colours?: Json
          compare_at_price?: number | null
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          discount_pct?: number | null
          gallery?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price: number
          sizes?: Json
          sku?: string | null
          slug: string
          specifications?: Json
          stock?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          colours?: Json
          compare_at_price?: number | null
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          discount_pct?: number | null
          gallery?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          sizes?: Json
          sku?: string | null
          slug?: string
          specifications?: Json
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      nexa_person_identities: {
        // Partial: only person_code is read by the frontend. Confirm against the live schema.
        Row: {
          person_code: string
        }
        Insert: {
          person_code?: string
        }
        Update: {
          person_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          customer_code: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_code?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_code?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_points: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_points?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_points?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_points: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          points: number
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          points: number
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          points?: number
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_points_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_applications: {
        Row: {
          applicant_id: string
          application_message: string | null
          created_at: string
          id: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_message?: string | null
          created_at?: string
          id?: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_message?: string | null
          created_at?: string
          id?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_links: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_enabled: boolean
          label: string
          platform: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_enabled?: boolean
          label: string
          platform: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_enabled?: boolean
          label?: string
          platform?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_location: string | null
          author_name: string
          created_at: string
          id: string
          is_active: boolean
          quote: string
          rating: number | null
          sort_order: number
        }
        Insert: {
          author_location?: string | null
          author_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          quote: string
          rating?: number | null
          sort_order?: number
        }
        Update: {
          author_location?: string | null
          author_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          quote?: string
          rating?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_code: { Args: { len: number; prefix: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_nexa_identity_announcement_login: {
        Args: { p_login_event_id: string }
        Returns: {
          display_number: number
          displays_remaining: number
          new_identity_code: string
          show_banner: boolean
        }[]
      }
      register_my_wallet: {
  Args: Record<PropertyKey, never>
  Returns: {
    wallet_id: string
    wallet_number: string
    currency: string
    status: string
    created_at: string
  }[]
  }
  review_role_application: {
        Args: {
          p_application_id: string
          p_decision: string
          p_review_notes?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "customer"
        | "partner"
        | "delivery"
        | "commission"
        | "ceo"
        | "finance"
        | "security"
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
    Enums: {
      app_role: [
        "admin",
        "customer",
        "partner",
        "delivery",
        "commission",
        "ceo",
        "finance",
        "security",
      ],
    },
  },
} as const
