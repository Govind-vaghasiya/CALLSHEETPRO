export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OrgMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
export type ProjectType = 'FEATURE' | 'SHORT' | 'TV' | 'COMMERCIAL' | 'MUSIC_VIDEO' | 'DOCUMENTARY' | 'OTHER'
export type ProjectStatus = 'DEVELOPMENT' | 'PRE_PRODUCTION' | 'PRODUCTION' | 'POST' | 'COMPLETED' | 'ARCHIVED'
export type ProjectMemberRole = 'OWNER' | 'ADMIN' | 'COORDINATOR' | 'MEMBER' | 'VIEWER'
export type ResourceType = 'PERSON' | 'EQUIPMENT' | 'LOCATION' | 'PROP' | 'VEHICLE' | 'ANIMAL' | 'OTHER'
export type RateType = 'FLAT' | 'DAILY' | 'HOURLY' | 'WEEKLY'
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'PARTIAL' | 'HOLD' | 'TRAVEL'
export type ScriptStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'ARCHIVED'
export type ScriptFileType = 'PDF' | 'FDX' | 'DOCX' | 'TXT' | 'OTHER'
export type RevisionColor = 'WHITE' | 'BLUE' | 'PINK' | 'YELLOW' | 'GREEN' | 'GOLDENROD' | 'BUFF' | 'SALMON' | 'CHERRY' | 'TAN' | 'DOUBLE_WHITE' | 'CUSTOM'
export type SceneStatus = 'DETECTED' | 'REVIEWED' | 'CONFIRMED' | 'LOCKED'
export type IntExt = 'INT' | 'EXT' | 'INT_EXT'
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MOMENTS_LATER' | 'SAME_TIME'
export type SceneElementType = 'CAST' | 'EXTRA' | 'PROP' | 'LOCATION' | 'WARDROBE' | 'MAKEUP' | 'VEHICLE' | 'ANIMAL' | 'STUNT' | 'VFX' | 'SFX' | 'SOUND' | 'EQUIPMENT' | 'MUSIC' | 'OTHER'
export type ElementConfirmStatus = 'AI_DETECTED' | 'CONFIRMED' | 'EDITED' | 'REMOVED'
export type SceneTagType = 'INT_EXT' | 'TIME_OF_DAY' | 'STUNT' | 'VFX_HEAVY' | 'NIGHT_SHOOT' | 'WATER' | 'ANIMALS' | 'CHILDREN' | 'SENSITIVE' | 'EXTERIOR_WEATHER' | 'CUSTOM'
export type ShootDayStatus = 'DRAFT' | 'PLANNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type VersionSource = 'USER' | 'AI' | 'SYSTEM' | 'IMPORT'
export type ConflictType = 'RESOURCE_UNAVAILABLE' | 'RESOURCE_DOUBLE_BOOKED' | 'LOCATION_UNAVAILABLE' | 'LOCATION_HOURS_VIOLATION' | 'EQUIPMENT_UNAVAILABLE' | 'TIME_CONFLICT' | 'TRAVEL_CONFLICT' | 'TURNAROUND_VIOLATION' | 'OVERTIME' | 'MISSING_RESOURCE' | 'DAY_NIGHT_MISMATCH' | 'LOCKED_DAY_MODIFIED' | 'OTHER'
export type ConflictSeverity = 'BLOCKING' | 'WARNING' | 'INFO'
export type ConflictStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED'
export type AiJobType = 'SCRIPT_BREAKDOWN' | 'SCHEDULE_ANALYSIS' | 'SCHEDULE_GENERATION' | 'CONFLICT_ANALYSIS' | 'RESOURCE_MATCHING' | 'AVAILABILITY_IMPACT' | 'OPTIMIZATION'
export type AiJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type AiSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
export type CallsheetStatus = 'DRAFT' | 'PUBLISHED' | 'REVISED' | 'ARCHIVED'
export type NotificationType = 'CONFLICT_DETECTED' | 'SCHEDULE_PUBLISHED' | 'CALL_SHEET_PUBLISHED' | 'CALL_SHEET_REVISED' | 'AI_JOB_COMPLETE' | 'AVAILABILITY_IMPACT' | 'COMMENT_MENTION' | 'COMMENT_REPLY' | 'RESOURCE_BOOKING_CHANGED' | 'SCRIPT_REVISION_UPLOADED' | 'INVITATION_RECEIVED' | 'MEMBER_JOINED'
export type NotificationChannel = 'IN_APP' | 'EMAIL'
export type GuestPermission = 'READ_SCHEDULE' | 'READ_CALLSHEET' | 'READ_BREAKDOWN' | 'READ_RESOURCES'
export type RuleConstraintType = 'HARD' | 'SOFT'
export type RuleCategory = 'WORKING_HOURS' | 'TURNAROUND' | 'CONSECUTIVE_DAYS' | 'COMPANY_MOVE' | 'OVERTIME' | 'TRAVEL' | 'SCHEDULING_PREFERENCE' | 'UNION_GUILD' | 'CUSTOM'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: OrgMemberRole
          invited_by: string | null
          joined_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: OrgMemberRole
          invited_by?: string | null
          joined_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: OrgMemberRole
          invited_by?: string | null
          joined_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          project_type: ProjectType
          status: ProjectStatus
          start_date: string | null
          target_end_date: string | null
          timezone: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          project_type?: ProjectType
          status?: ProjectStatus
          start_date?: string | null
          target_end_date?: string | null
          timezone?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          project_type?: ProjectType
          status?: ProjectStatus
          start_date?: string | null
          target_end_date?: string | null
          timezone?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: ProjectMemberRole
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: ProjectMemberRole
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: ProjectMemberRole
          created_at?: string
        }
        Relationships: []
      }
      project_settings: {
        Row: {
          id: string
          project_id: string
          default_call_time: string
          default_wrap_time: string | null
          max_shooting_hours: number
          min_turnaround_hours: number
          company_move_threshold: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          default_call_time?: string
          default_wrap_time?: string | null
          max_shooting_hours?: number
          min_turnaround_hours?: number
          company_move_threshold?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          default_call_time?: string
          default_wrap_time?: string | null
          max_shooting_hours?: number
          min_turnaround_hours?: number
          company_move_threshold?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          project_id: string
          name: string
          code: string | null
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          code?: string | null
          color?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          code?: string | null
          color?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          department_id: string
          project_id: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          department_id: string
          project_id: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          department_id?: string
          project_id?: string
          name?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          id: string
          project_id: string
          resource_type: ResourceType
          name: string
          display_name: string | null
          email: string | null
          phone: string | null
          notes: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          resource_type: ResourceType
          name: string
          display_name?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          resource_type?: ResourceType
          name?: string
          display_name?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_roles: {
        Row: {
          id: string
          resource_id: string
          role_id: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          role_id: string
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          role_id?: string
          is_primary?: boolean
          created_at?: string
        }
        Relationships: []
      }
      resource_rates: {
        Row: {
          id: string
          resource_id: string
          rate_type: RateType
          rate_amount: number | null
          currency: string
          estimated_days: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          rate_type?: RateType
          rate_amount?: number | null
          currency?: string
          estimated_days?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          rate_type?: RateType
          rate_amount?: number | null
          currency?: string
          estimated_days?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      location_details: {
        Row: {
          id: string
          resource_id: string
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state_province: string | null
          postal_code: string | null
          country: string | null
          latitude: number | null
          longitude: number | null
          maps_place_id: string | null
          parking_notes: string | null
          nearest_hospital: string | null
          nearest_hospital_km: number | null
          access_hours_start: string | null
          access_hours_end: string | null
          permit_required: boolean
          permit_type: string | null
          permit_expiry: string | null
          permit_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_place_id?: string | null
          parking_notes?: string | null
          nearest_hospital?: string | null
          nearest_hospital_km?: number | null
          access_hours_start?: string | null
          access_hours_end?: string | null
          permit_required?: boolean
          permit_type?: string | null
          permit_expiry?: string | null
          permit_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          maps_place_id?: string | null
          parking_notes?: string | null
          nearest_hospital?: string | null
          nearest_hospital_km?: number | null
          access_hours_start?: string | null
          access_hours_end?: string | null
          permit_required?: boolean
          permit_type?: string | null
          permit_expiry?: string | null
          permit_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      script_documents: {
        Row: {
          id: string
          project_id: string
          file_name: string
          storage_path: string
          file_type: ScriptFileType
          file_size_bytes: number | null
          status: ScriptStatus
          version: number
          revision_color: RevisionColor
          revision_date: string | null
          revision_notes: string | null
          is_current: boolean
          total_pages: number | null
          total_scenes: number | null
          uploaded_by: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          file_name: string
          storage_path: string
          file_type: ScriptFileType
          file_size_bytes?: number | null
          status?: ScriptStatus
          version?: number
          revision_color?: RevisionColor
          revision_date?: string | null
          revision_notes?: string | null
          is_current?: boolean
          total_pages?: number | null
          total_scenes?: number | null
          uploaded_by?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          file_name?: string
          storage_path?: string
          file_type?: ScriptFileType
          file_size_bytes?: number | null
          status?: ScriptStatus
          version?: number
          revision_color?: RevisionColor
          revision_date?: string | null
          revision_notes?: string | null
          is_current?: boolean
          total_pages?: number | null
          total_scenes?: number | null
          uploaded_by?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      script_pages: {
        Row: {
          id: string
          script_document_id: string
          page_number: number
          raw_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          script_document_id: string
          page_number: number
          raw_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          script_document_id?: string
          page_number?: number
          raw_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
      scenes: {
        Row: {
          id: string
          project_id: string
          script_document_id: string | null
          scene_number: string
          scene_order: number | null
          heading: string | null
          int_ext: IntExt | null
          location_name: string | null
          time_of_day: TimeOfDay | null
          page_start: number | null
          page_end: number | null
          description: string | null
          estimated_duration: number | null
          episode_number: string | null
          status: SceneStatus
          ai_confidence: number | null
          revision_color: RevisionColor | null
          is_changed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          script_document_id?: string | null
          scene_number: string
          scene_order?: number | null
          heading?: string | null
          int_ext?: IntExt | null
          location_name?: string | null
          time_of_day?: TimeOfDay | null
          page_start?: number | null
          page_end?: number | null
          description?: string | null
          estimated_duration?: number | null
          episode_number?: string | null
          status?: SceneStatus
          ai_confidence?: number | null
          revision_color?: RevisionColor | null
          is_changed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          script_document_id?: string | null
          scene_number?: string
          scene_order?: number | null
          heading?: string | null
          int_ext?: IntExt | null
          location_name?: string | null
          time_of_day?: TimeOfDay | null
          page_start?: number | null
          page_end?: number | null
          description?: string | null
          estimated_duration?: number | null
          episode_number?: string | null
          status?: SceneStatus
          ai_confidence?: number | null
          revision_color?: RevisionColor | null
          is_changed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      scene_elements: {
        Row: {
          id: string
          scene_id: string
          element_type: SceneElementType
          name: string
          description: string | null
          ai_confidence: number | null
          confirm_status: ElementConfirmStatus
          confirmed_by: string | null
          confirmed_at: string | null
          notes: string | null
          character_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          element_type: SceneElementType
          name: string
          description?: string | null
          ai_confidence?: number | null
          confirm_status?: ElementConfirmStatus
          confirmed_by?: string | null
          confirmed_at?: string | null
          notes?: string | null
          character_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          element_type?: SceneElementType
          name?: string
          description?: string | null
          ai_confidence?: number | null
          confirm_status?: ElementConfirmStatus
          confirmed_by?: string | null
          confirmed_at?: string | null
          notes?: string | null
          character_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      scene_requirements: {
        Row: {
          id: string
          scene_id: string
          resource_id: string
          element_id: string | null
          required: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          resource_id: string
          element_id?: string | null
          required?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          resource_id?: string
          element_id?: string | null
          required?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      scene_tags: {
        Row: {
          id: string
          project_id: string
          scene_id: string
          tag_type: SceneTagType
          label: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          scene_id: string
          tag_type?: SceneTagType
          label: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          scene_id?: string
          tag_type?: SceneTagType
          label?: string
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      scene_notes: {
        Row: {
          id: string
          scene_id: string
          note: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          note: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          note?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shoot_days: {
        Row: {
          id: string
          project_id: string
          shoot_date: string
          day_number: number | null
          call_time: string | null
          wrap_time: string | null
          status: ShootDayStatus
          primary_location_id: string | null
          notes: string | null
          is_locked: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          shoot_date: string
          day_number?: number | null
          call_time?: string | null
          wrap_time?: string | null
          status?: ShootDayStatus
          primary_location_id?: string | null
          notes?: string | null
          is_locked?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          shoot_date?: string
          day_number?: number | null
          call_time?: string | null
          wrap_time?: string | null
          status?: ShootDayStatus
          primary_location_id?: string | null
          notes?: string | null
          is_locked?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shoot_day_scenes: {
        Row: {
          id: string
          shoot_day_id: string
          scene_id: string
          sort_order: number
          estimated_minutes: number | null
          actual_minutes: number | null
          fixed_start_time: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shoot_day_id: string
          scene_id: string
          sort_order?: number
          estimated_minutes?: number | null
          actual_minutes?: number | null
          fixed_start_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shoot_day_id?: string
          scene_id?: string
          sort_order?: number
          estimated_minutes?: number | null
          actual_minutes?: number | null
          fixed_start_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_bookings: {
        Row: {
          id: string
          project_id: string
          shoot_day_id: string
          resource_id: string
          scene_id: string | null
          call_time: string | null
          wrap_time: string | null
          start_at: string | null
          end_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          shoot_day_id: string
          resource_id: string
          scene_id?: string | null
          call_time?: string | null
          wrap_time?: string | null
          start_at?: string | null
          end_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          shoot_day_id?: string
          resource_id?: string
          scene_id?: string | null
          call_time?: string | null
          wrap_time?: string | null
          start_at?: string | null
          end_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_line_items: {
        Row: {
          id: string
          project_id: string
          label: string
          amount: number
          currency: string
          category: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          label: string
          amount: number
          currency?: string
          category?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          label?: string
          amount?: number
          currency?: string
          category?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          notification_type: NotificationType
          title: string
          body: string | null
          link_url: string | null
          entity_type: string | null
          entity_id: string | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          notification_type: NotificationType
          title: string
          body?: string | null
          link_url?: string | null
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          notification_type?: NotificationType
          title?: string
          body?: string | null
          link_url?: string | null
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          project_id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          id: string
          project_id: string
          name: string
          cast_number: number | null
          actor_resource_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          cast_number?: number | null
          actor_resource_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          cast_number?: number | null
          actor_resource_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_availability: {
        Row: {
          id: string
          resource_id: string
          project_id: string
          start_at: string
          end_at: string
          status: AvailabilityStatus
          reason: string | null
          notes: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          project_id: string
          start_at: string
          end_at: string
          status: AvailabilityStatus
          reason?: string | null
          notes?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          project_id?: string
          start_at?: string
          end_at?: string
          status?: AvailabilityStatus
          reason?: string | null
          notes?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_versions: {
        Row: {
          id: string
          project_id: string
          version_number: number
          commit_message: string | null
          source: VersionSource
          created_by: string | null
          schedule_json: Json
          is_current: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          version_number: number
          commit_message?: string | null
          source?: VersionSource
          created_by?: string | null
          schedule_json: Json
          is_current?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          version_number?: number
          commit_message?: string | null
          source?: VersionSource
          created_by?: string | null
          schedule_json?: Json
          is_current?: boolean
          created_at?: string
        }
        Relationships: []
      }
      call_sheets: {
        Row: {
          id: string
          project_id: string
          shoot_day_id: string
          version: number
          status: CallsheetStatus
          title: string | null
          general_call_time: string | null
          shoot_date: string | null
          primary_location_id: string | null
          weather_data: Json | null
          weather_fetched_at: string | null
          special_instructions: string | null
          advanced_call: string | null
          nearest_hospital: string | null
          nearest_hospital_km: number | null
          catering_notes: string | null
          branding_header: Json | null
          share_token: string | null
          share_enabled: boolean
          pdf_storage_path: string | null
          published_at: string | null
          published_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          shoot_day_id: string
          version?: number
          status?: CallsheetStatus
          title?: string | null
          general_call_time?: string | null
          shoot_date?: string | null
          primary_location_id?: string | null
          weather_data?: Json | null
          weather_fetched_at?: string | null
          special_instructions?: string | null
          advanced_call?: string | null
          nearest_hospital?: string | null
          nearest_hospital_km?: number | null
          catering_notes?: string | null
          branding_header?: Json | null
          share_token?: string | null
          share_enabled?: boolean
          pdf_storage_path?: string | null
          published_at?: string | null
          published_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          shoot_day_id?: string
          version?: number
          status?: CallsheetStatus
          title?: string | null
          general_call_time?: string | null
          shoot_date?: string | null
          primary_location_id?: string | null
          weather_data?: Json | null
          weather_fetched_at?: string | null
          special_instructions?: string | null
          advanced_call?: string | null
          nearest_hospital?: string | null
          nearest_hospital_km?: number | null
          catering_notes?: string | null
          branding_header?: Json | null
          share_token?: string | null
          share_enabled?: boolean
          pdf_storage_path?: string | null
          published_at?: string | null
          published_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_tokens: {
        Row: {
          id: string
          project_id: string
          token: string
          label: string
          created_by: string
          is_active: boolean
          expires_at: string | null
          last_used_at: string | null
          use_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          token?: string
          label: string
          created_by: string
          is_active?: boolean
          expires_at?: string | null
          last_used_at?: string | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          token?: string
          label?: string
          created_by?: string
          is_active?: boolean
          expires_at?: string | null
          last_used_at?: string | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_token_permissions: {
        Row: {
          id: string
          token_id: string
          permission: GuestPermission
          created_at: string
        }
        Insert: {
          id?: string
          token_id: string
          permission: GuestPermission
          created_at?: string
        }
        Update: {
          id?: string
          token_id?: string
          permission?: GuestPermission
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: {
        Args: { proj_id: string }
        Returns: boolean
      }
      can_modify_project: {
        Args: { proj_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type SceneElementItem = Database['public']['Tables']['scene_elements']['Row']
export type SceneRequirementItem = Database['public']['Tables']['scene_requirements']['Row']
export type SceneTagItem = Database['public']['Tables']['scene_tags']['Row']
export type SceneNoteItem = Database['public']['Tables']['scene_notes']['Row']
export type ShootDayItem = Database['public']['Tables']['shoot_days']['Row']
export type ShootDaySceneItem = Database['public']['Tables']['shoot_day_scenes']['Row']
export type ResourceBookingItem = Database['public']['Tables']['resource_bookings']['Row']
export type ResourceAvailabilityItem = Database['public']['Tables']['resource_availability']['Row']
export type ScheduleVersionItem = Database['public']['Tables']['schedule_versions']['Row']
export type CallSheetItem = Database['public']['Tables']['call_sheets']['Row']
export type GuestTokenItem = Database['public']['Tables']['guest_tokens']['Row']
export type CharacterItem = Database['public']['Tables']['characters']['Row']
