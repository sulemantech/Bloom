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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"] | null
          created_at: string
          id: string
          instructions: Json
          position: number
          stage_id: string
          submission_type: Database["public"]["Enums"]["submission_type"]
          title: Json
          week: number
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          created_at?: string
          id?: string
          instructions: Json
          position?: number
          stage_id: string
          submission_type?: Database["public"]["Enums"]["submission_type"]
          title: Json
          week: number
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          created_at?: string
          id?: string
          instructions?: Json
          position?: number
          stage_id?: string
          submission_type?: Database["public"]["Enums"]["submission_type"]
          title?: Json
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "activities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          changed_columns: string[] | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          changed_columns?: string[] | null
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          changed_columns?: string[] | null
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      cohorts: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          program_id: string
          schedule: Json | null
          start_date: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          program_id: string
          schedule?: Json | null
          start_date?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          program_id?: string
          schedule?: Json | null
          start_date?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          granted_at: string
          id: string
          parent_id: string
          revoked_at: string | null
          student_id: string
          type: Database["public"]["Enums"]["consent_type"]
          version: string
        }
        Insert: {
          granted_at?: string
          id?: string
          parent_id: string
          revoked_at?: string | null
          student_id: string
          type: Database["public"]["Enums"]["consent_type"]
          version: string
        }
        Update: {
          granted_at?: string
          id?: string
          parent_id?: string
          revoked_at?: string | null
          student_id?: string
          type?: Database["public"]["Enums"]["consent_type"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          cohort_id: string | null
          created_at: string
          enabled: boolean
          id: string
          key: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          mentor_id: string | null
          submission_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          submission_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          cohort_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          cohort_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          cohort_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"] | null
          cohort_id: string
          created_at: string
          discount_reason: string | null
          fee_amount: number | null
          id: string
          paid_at: string | null
          refunded_at: string | null
          role: Database["public"]["Enums"]["cohort_role"]
          user_id: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          cohort_id: string
          created_at?: string
          discount_reason?: string | null
          fee_amount?: number | null
          id?: string
          paid_at?: string | null
          refunded_at?: string | null
          role: Database["public"]["Enums"]["cohort_role"]
          user_id: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          cohort_id?: string
          created_at?: string
          discount_reason?: string | null
          fee_amount?: number | null
          id?: string
          paid_at?: string | null
          refunded_at?: string | null
          role?: Database["public"]["Enums"]["cohort_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_year: number | null
          country: string | null
          created_at: string
          full_name: string
          id: string
          locale: string
          organization_id: string | null
          prefers_female_mentor: boolean
          role: Database["public"]["Enums"]["app_role"]
          timezone: string
          updated_at: string
          username: string | null
        }
        Insert: {
          birth_year?: number | null
          country?: string | null
          created_at?: string
          full_name?: string
          id: string
          locale?: string
          organization_id?: string | null
          prefers_female_mentor?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          birth_year?: number | null
          country?: string | null
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          organization_id?: string | null
          prefers_female_mentor?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          id: string
          name: Json
          organization_id: string | null
          slug: string
          weeks: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: Json
          organization_id?: string | null
          slug: string
          weeks: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: Json
          organization_id?: string | null
          slug?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_cards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          cohort_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["card_status"]
          student_id: string
          updated_at: string
          viewed_at: string | null
          week: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          cohort_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          student_id: string
          updated_at?: string
          viewed_at?: string | null
          week: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          cohort_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          student_id?: string
          updated_at?: string
          viewed_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_cards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_cards_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area: Database["public"]["Enums"]["project_area"]
          cohort_id: string
          created_at: string
          id: string
          is_public: boolean
          problem: string | null
          status: Database["public"]["Enums"]["project_status"]
          student_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["project_area"]
          cohort_id: string
          created_at?: string
          id?: string
          is_public?: boolean
          problem?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          student_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["project_area"]
          cohort_id?: string
          created_at?: string
          id?: string
          is_public?: boolean
          problem?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          student_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          join_url: string | null
          recording_url: string | null
          starts_at: string
          title: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          join_url?: string | null
          recording_url?: string | null
          starts_at: string
          title?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          join_url?: string | null
          recording_url?: string | null
          starts_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          id: string
          key: string
          name: Json
          position: number
          program_id: string
          summary: Json | null
          week_from: number
          week_to: number
        }
        Insert: {
          id?: string
          key: string
          name: Json
          position: number
          program_id: string
          summary?: Json | null
          week_from: number
          week_to: number
        }
        Update: {
          id?: string
          key?: string
          name?: Json
          position?: number
          program_id?: string
          summary?: Json | null
          week_from?: number
          week_to?: number
        }
        Relationships: [
          {
            foreignKeyName: "stages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          activity_id: string
          body: string
          cohort_id: string
          id: string
          link_url: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          body?: string
          cohort_id: string
          id?: string
          link_url?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          body?: string
          cohort_id?: string
          id?: string
          link_url?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_student: { Args: { p_student: string }; Returns: boolean }
      export_student_data: { Args: { p_student: string }; Returns: Json }
      has_active_consent: {
        Args: {
          p_student: string
          p_type: Database["public"]["Enums"]["consent_type"]
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_cohort_member: { Args: { p_cohort: string }; Returns: boolean }
      is_cohort_mentor: { Args: { p_cohort: string }; Returns: boolean }
      is_parent_in_cohort: { Args: { p_cohort: string }; Returns: boolean }
      is_parent_of: { Args: { p_student: string }; Returns: boolean }
      mark_progress_card_viewed: {
        Args: { p_card: string }
        Returns: undefined
      }
      mentors_student: { Args: { p_student: string }; Returns: boolean }
    }
    Enums: {
      age_group: "explorer" | "builder"
      app_role: "student" | "parent" | "mentor" | "admin"
      card_status: "draft" | "approved"
      cohort_role: "student" | "mentor"
      consent_type: "platform" | "public_portfolio" | "media" | "ai"
      project_area:
        | "technology"
        | "design"
        | "business"
        | "social_impact"
        | "undecided"
      project_status:
        | "exploring"
        | "chosen"
        | "building"
        | "presenting"
        | "done"
      submission_status: "submitted" | "needs_changes" | "done"
      submission_type: "text" | "file" | "link" | "text_and_file"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      age_group: ["explorer", "builder"],
      app_role: ["student", "parent", "mentor", "admin"],
      card_status: ["draft", "approved"],
      cohort_role: ["student", "mentor"],
      consent_type: ["platform", "public_portfolio", "media", "ai"],
      project_area: [
        "technology",
        "design",
        "business",
        "social_impact",
        "undecided",
      ],
      project_status: ["exploring", "chosen", "building", "presenting", "done"],
      submission_status: ["submitted", "needs_changes", "done"],
      submission_type: ["text", "file", "link", "text_and_file"],
    },
  },
} as const
