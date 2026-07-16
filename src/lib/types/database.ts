// Types de la base de données Supabase.
// Écrits à la main à partir des migrations (supabase/migrations),
// à régénérer avec `npx supabase gen types typescript` quand c'est possible.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BusinessType =
  | "equipment"
  | "vehicles"
  | "nautical"
  | "events"
  | "other";

export type MemberRole = "owner" | "admin" | "member";

export type CustomerType = "individual" | "company";

export type EquipmentStatus = "available" | "maintenance" | "unavailable";

export type BookingStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "deposit_paid" | "paid" | "refunded";

export type DepositStatus =
  | "not_required"
  | "pending"
  | "received"
  | "returned"
  | "partially_withheld"
  | "withheld";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          business_type: BusinessType;
          logo_url: string | null;
          currency: string;
          timezone: string;
          locale: string;
          date_format: string;
          booking_prefix: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          onboarding_completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_type?: BusinessType;
          logo_url?: string | null;
          currency?: string;
          timezone?: string;
          locale?: string;
          date_format?: string;
          booking_prefix?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          onboarding_completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_type?: BusinessType;
          logo_url?: string | null;
          currency?: string;
          timezone?: string;
          locale?: string;
          date_format?: string;
          booking_prefix?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          onboarding_completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
        Relationships: [];
      };
      equipment_categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment_items: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string | null;
          name: string;
          internal_ref: string | null;
          description: string | null;
          daily_price: number;
          deposit_amount: number;
          quantity_total: number;
          min_rental_days: number;
          status: EquipmentStatus;
          usage_instructions: string | null;
          internal_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id?: string | null;
          name: string;
          internal_ref?: string | null;
          description?: string | null;
          daily_price?: number;
          deposit_amount?: number;
          quantity_total?: number;
          min_rental_days?: number;
          status?: EquipmentStatus;
          usage_instructions?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category_id?: string | null;
          name?: string;
          internal_ref?: string | null;
          description?: string | null;
          daily_price?: number;
          deposit_amount?: number;
          quantity_total?: number;
          min_rental_days?: number;
          status?: EquipmentStatus;
          usage_instructions?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "equipment_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      equipment_images: {
        Row: {
          id: string;
          organization_id: string;
          equipment_id: string;
          storage_path: string;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          equipment_id: string;
          storage_path: string;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          equipment_id?: string;
          storage_path?: string;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_images_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_images_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          type: CustomerType;
          first_name: string;
          last_name: string;
          company_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          id_number: string | null;
          internal_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type?: CustomerType;
          first_name?: string;
          last_name?: string;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          id_number?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          type?: CustomerType;
          first_name?: string;
          last_name?: string;
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          id_number?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          organization_id: string;
          booking_number: string;
          customer_id: string;
          status: BookingStatus;
          start_at: string;
          end_at: string;
          duration_days: number;
          subtotal: number;
          discount_amount: number;
          extra_fees_amount: number;
          total_amount: number;
          deposit_amount: number;
          payment_status: PaymentStatus;
          deposit_status: DepositStatus;
          notes: string | null;
          created_by: string | null;
          confirmed_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          booking_number: string;
          customer_id: string;
          status?: BookingStatus;
          start_at: string;
          end_at: string;
          duration_days?: number;
          subtotal?: number;
          discount_amount?: number;
          extra_fees_amount?: number;
          total_amount?: number;
          deposit_amount?: number;
          payment_status?: PaymentStatus;
          deposit_status?: DepositStatus;
          notes?: string | null;
          created_by?: string | null;
          confirmed_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          booking_number?: string;
          customer_id?: string;
          status?: BookingStatus;
          start_at?: string;
          end_at?: string;
          duration_days?: number;
          subtotal?: number;
          discount_amount?: number;
          extra_fees_amount?: number;
          total_amount?: number;
          deposit_amount?: number;
          payment_status?: PaymentStatus;
          deposit_status?: DepositStatus;
          notes?: string | null;
          created_by?: string | null;
          confirmed_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_items: {
        Row: {
          id: string;
          organization_id: string;
          booking_id: string;
          equipment_id: string;
          quantity: number;
          daily_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          booking_id: string;
          equipment_id: string;
          quantity?: number;
          daily_price?: number;
          line_total?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          booking_id?: string;
          equipment_id?: string;
          quantity?: number;
          daily_price?: number;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_items_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_status_history: {
        Row: {
          id: string;
          organization_id: string;
          booking_id: string;
          from_status: BookingStatus | null;
          to_status: BookingStatus;
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          booking_id: string;
          from_status?: BookingStatus | null;
          to_status: BookingStatus;
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          booking_id?: string;
          from_status?: BookingStatus | null;
          to_status?: BookingStatus;
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_records: {
        Row: {
          id: string;
          organization_id: string;
          equipment_id: string;
          description: string;
          started_at: string;
          ended_at: string | null;
          cost: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          equipment_id: string;
          description: string;
          started_at?: string;
          ended_at?: string | null;
          cost?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          equipment_id?: string;
          description?: string;
          started_at?: string;
          ended_at?: string | null;
          cost?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_records_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment_items";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_conversations: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          tool_calls: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content?: string;
          tool_calls?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          conversation_id?: string;
          role?: "user" | "assistant" | "system" | "tool";
          content?: string;
          tool_calls?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "assistant_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      booking_counters: {
        Row: {
          organization_id: string;
          year: number;
          seq: number;
        };
        Insert: {
          organization_id: string;
          year: number;
          seq?: number;
        };
        Update: {
          organization_id?: string;
          year?: number;
          seq?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      user_org_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      org_peer_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_org_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      create_organization_with_owner: {
        Args: {
          p_name: string;
          p_business_type?: BusinessType;
          p_booking_prefix?: string | null;
        };
        Returns: string;
      };
      generate_booking_number: {
        Args: { p_organization_id: string };
        Returns: string;
      };
      check_equipment_availability: {
        Args: {
          p_equipment_id: string;
          p_start_at: string;
          p_end_at: string;
          p_quantity?: number;
          p_exclude_booking_id?: string | null;
        };
        Returns: Json;
      };
      create_booking: {
        Args: {
          p_organization_id: string;
          p_customer_id: string;
          p_start_at: string;
          p_end_at: string;
          p_duration_days: number;
          p_items: Json;
          p_subtotal: number;
          p_discount_amount: number;
          p_extra_fees_amount: number;
          p_total_amount: number;
          p_deposit_amount: number;
          p_status?: BookingStatus;
          p_notes?: string | null;
        };
        Returns: string;
      };
      update_booking_details: {
        Args: {
          p_booking_id: string;
          p_customer_id: string;
          p_start_at: string;
          p_end_at: string;
          p_duration_days: number;
          p_items: Json;
          p_subtotal: number;
          p_discount_amount: number;
          p_extra_fees_amount: number;
          p_total_amount: number;
          p_deposit_amount: number;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      list_equipment_availability: {
        Args: {
          p_organization_id: string;
          p_start_at: string;
          p_end_at: string;
        };
        Returns: {
          equipment_id: string;
          name: string;
          status: EquipmentStatus;
          quantity_total: number;
          quantity_booked: number;
          quantity_available: number;
        }[];
      };
    };
    Enums: {
      business_type: BusinessType;
      member_role: MemberRole;
      customer_type: CustomerType;
      equipment_status: EquipmentStatus;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      deposit_status: DepositStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Alias pratiques pour le reste de l'application.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Organization = Tables<"organizations">;
export type OrganizationMember = Tables<"organization_members">;
export type EquipmentCategory = Tables<"equipment_categories">;
export type EquipmentItem = Tables<"equipment_items">;
export type EquipmentImage = Tables<"equipment_images">;
export type Customer = Tables<"customers">;
export type Booking = Tables<"bookings">;
export type BookingItem = Tables<"booking_items">;
export type BookingStatusHistory = Tables<"booking_status_history">;
export type MaintenanceRecord = Tables<"maintenance_records">;
export type AssistantConversation = Tables<"assistant_conversations">;
export type AssistantMessage = Tables<"assistant_messages">;
export type ActivityLog = Tables<"activity_logs">;

// Résultat de check_equipment_availability (jsonb côté SQL).
export type AvailabilityConflict = {
  booking_id: string;
  booking_number: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  quantity: number;
  customer_name: string;
};

export type AvailabilityResult = {
  available: boolean;
  reason:
    | "invalid_period"
    | "not_found"
    | "unavailable"
    | "maintenance"
    | "conflict"
    | null;
  available_quantity: number;
  total_quantity: number;
  conflicts: AvailabilityConflict[];
};

export type EquipmentAvailabilityRow = {
  equipment_id: string;
  name: string;
  status: EquipmentStatus;
  quantity_total: number;
  quantity_booked: number;
  quantity_available: number;
};
