export type UserRole = 'pupil' | 'student' | 'parent' | 'teacher'
export type ListingKind = 'good' | 'service'
export type ContentReportTarget = 'job' | 'achievement' | 'message' | 'listing' | 'profile'
export type JobApplicationStatus =
  | 'submitted'
  | 'viewed'
  | 'replied'
  | 'test_task'
  | 'interview'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
export type JobWorkMode = 'any' | 'remote' | 'onsite' | 'hybrid'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          role: UserRole
          display_name: string
          location: string | null
          headline: string | null
          school_or_org: string | null
          is_employer: boolean
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          github_url: string | null
          telegram_url: string | null
          linkedin_url: string | null
          website_url: string | null
          profile_views: number
          accent_color: string | null
          is_admin: boolean
          referred_by: string | null
          onboarding_bonus_claimed: boolean
          onboarding_completed_at: string | null
          onboarding_dismissed_at: string | null
          org_verified: boolean
          is_banned: boolean
          portfolio_links: unknown
          onboarding_snoozed_until: string | null
          is_moderator: boolean
          activity_streak_count: number
          activity_streak_last_utc: string | null
          username: string | null
          is_verified_employer: boolean
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string
          display_name?: string
          role?: UserRole
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      student_links: {
        Row: {
          id: string
          student_id: string
          guardian_id: string | null
          link_type: 'parent' | 'teacher'
          status: 'pending' | 'accepted' | 'revoked'
          invite_code: string
          expires_at: string
          created_at: string
          accepted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['student_links']['Row']> & {
          student_id: string
          link_type: 'parent' | 'teacher'
          invite_code: string
        }
        Update: Partial<Database['public']['Tables']['student_links']['Row']>
      }
      admin_news: {
        Row: {
          id: string
          title: string
          body: string
          cta_label: string | null
          cta_url: string | null
          is_published: boolean
          is_pinned: boolean
          starts_at: string | null
          ends_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['admin_news']['Row']> & {
          title: string
          body: string
        }
        Update: Partial<Database['public']['Tables']['admin_news']['Row']>
      }
      user_settings: {
        Row: {
          user_id: string
          notify_follows: boolean
          notify_messages: boolean
          notify_achievements: boolean
          profile_public: boolean
          show_in_people_search: boolean
          updated_at: string
          theme: string
          reduce_motion: boolean
          digest_email_enabled: boolean
          push_notify_opt_in: boolean
        }
        Insert: {
          user_id: string
          notify_follows?: boolean
          notify_messages?: boolean
          notify_achievements?: boolean
          profile_public?: boolean
          show_in_people_search?: boolean
          theme?: string
          reduce_motion?: boolean
          digest_email_enabled?: boolean
          push_notify_opt_in?: boolean
        }
        Update: Partial<Omit<Database['public']['Tables']['user_settings']['Row'], 'user_id'>>
      }
      profile_skills: {
        Row: {
          id: string
          user_id: string
          skill: string
          created_at: string
        }
        Insert: {
          user_id: string
          skill: string
        }
        Update: never
      }
      achievement_categories: {
        Row: {
          id: string
          slug: string
          label_ru: string
          default_points: number
        }
      }
      achievements: {
        Row: {
          id: string
          user_id: string
          category_id: string
          title: string
          description: string | null
          file_path: string | null
          points_awarded: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          category_id: string
          title: string
          description?: string | null
          file_path?: string | null
        }
        Update: Partial<
          Omit<
            Database['public']['Tables']['achievements']['Row'],
            'id' | 'user_id' | 'points_awarded'
          >
        >
      }
      user_category_scores: {
        Row: {
          user_id: string
          category_id: string
          points: number
        }
      }
      listings: {
        Row: {
          id: string
          owner_id: string
          kind: ListingKind
          title: string
          description: string | null
          price_text: string | null
          image_url: string | null
          collection_slug: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          kind?: ListingKind
          title: string
          description?: string | null
          price_text?: string | null
          image_url?: string | null
          collection_slug?: string | null
        }
        Update: Partial<
          Omit<Database['public']['Tables']['listings']['Row'], 'id' | 'owner_id' | 'created_at'>
        >
      }
      jobs: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          format_text: string | null
          is_featured: boolean
          featured_until: string | null
          work_mode: JobWorkMode
          company_name: string | null
          hide_company_until_applied: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          title: string
          description?: string | null
          format_text?: string | null
          is_featured?: boolean
          featured_until?: string | null
          work_mode?: JobWorkMode
          company_name?: string | null
          hide_company_until_applied?: boolean
        }
        Update: Partial<
          Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'owner_id' | 'created_at'>
        >
      }
      job_applications: {
        Row: {
          id: string
          job_id: string
          applicant_id: string
          status: JobApplicationStatus
          cv_url: string | null
          portfolio_url: string | null
          interview_slot: string | null
          owner_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          job_id: string
          applicant_id: string
          status?: JobApplicationStatus
          cv_url?: string | null
          portfolio_url?: string | null
          interview_slot?: string | null
          owner_note?: string | null
        }
        Update: Partial<
          Omit<
            Database['public']['Tables']['job_applications']['Row'],
            'id' | 'job_id' | 'applicant_id' | 'created_at'
          >
        >
      }
      profile_recommendations: {
        Row: {
          id: string
          author_id: string
          subject_id: string
          body: string
          is_public: boolean
          created_at: string
        }
        Insert: {
          author_id: string
          subject_id: string
          body: string
          is_public?: boolean
        }
        Update: Partial<Omit<Database['public']['Tables']['profile_recommendations']['Row'], 'id' | 'created_at'>>
      }
      content_reports: {
        Row: {
          id: string
          reporter_id: string
          target_type: ContentReportTarget
          target_id: string
          reason: string | null
          status: 'open' | 'resolved' | 'dismissed'
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          reporter_id: string
          target_type: ContentReportTarget
          target_id: string
          reason?: string | null
          status?: 'open' | 'resolved' | 'dismissed'
        }
        Update: Partial<
          Pick<
            Database['public']['Tables']['content_reports']['Row'],
            'status' | 'resolved_at' | 'resolved_by'
          >
        >
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: never
        Update: never
      }
      interests: {
        Row: {
          id: string
          slug: string
          label_ru: string
        }
      }
      profile_interests: {
        Row: {
          user_id: string
          interest_id: string
        }
        Insert: {
          user_id: string
          interest_id: string
        }
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
        }
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          is_group: boolean
          title: string | null
        }
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
          last_read_at: string | null
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string | null
          attachment_url: string | null
          attachment_name: string | null
          reply_to_id: string | null
          created_at: string
        }
        Insert: {
          conversation_id: string
          sender_id: string
          body?: string | null
          attachment_url?: string | null
          attachment_name?: string | null
          reply_to_id?: string | null
        }
      }
      job_alerts: {
        Row: {
          id: string
          user_id: string
          employment_type: string | null
          work_mode: string | null
          sphere: string | null
          query_text: string | null
          enabled: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          employment_type?: string | null
          work_mode?: string | null
          sphere?: string | null
          query_text?: string | null
          enabled?: boolean
        }
        Update: Partial<Pick<Database['public']['Tables']['job_alerts']['Row'], 'enabled' | 'employment_type' | 'work_mode' | 'sphere' | 'query_text'>>
      }
      communities: {
        Row: {
          id: string
          slug: string
          title: string
          region_label: string
          created_at: string
        }
        Insert: {
          slug: string
          title: string
          region_label?: string
        }
        Update: Partial<Pick<Database['public']['Tables']['communities']['Row'], 'title' | 'region_label'>>
      }
      community_members: {
        Row: {
          community_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          community_id: string
          user_id: string
        }
        Update: never
      }
      mentorship_requests: {
        Row: {
          id: string
          mentee_id: string
          mentor_id: string
          note: string | null
          status: 'pending' | 'accepted' | 'declined' | 'cancelled'
          created_at: string
        }
        Insert: {
          mentee_id: string
          mentor_id: string
          note?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled'
        }
        Update: Partial<Pick<Database['public']['Tables']['mentorship_requests']['Row'], 'status' | 'note'>>
      }
      events: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          starts_at: string
          ends_at: string | null
          location_text: string | null
          is_online: boolean
          is_public: boolean
          created_at: string
        }
        Insert: {
          owner_id: string
          title: string
          description?: string | null
          starts_at: string
          ends_at?: string | null
          location_text?: string | null
          is_online?: boolean
          is_public?: boolean
        }
        Update: Partial<
          Omit<Database['public']['Tables']['events']['Row'], 'id' | 'owner_id' | 'created_at'>
        >
      }
    }
    Functions: {
      get_or_create_dm: {
        Args: { other_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { p_title: string; p_member_ids: string[] }
        Returns: string
      }
      my_chat_sidebar: {
        Args: Record<string, never>
        Returns: {
          conversation_id: string
          is_group: boolean
          title: string | null
          last_body: string | null
          last_at: string | null
          last_sender_id: string | null
          unread_count: number
          has_unread: boolean
          other_user_ids: string[]
        }[]
      }
      get_conversation_members: {
        Args: { p_conv_id: string }
        Returns: { user_id: string }[]
      }
      get_or_create_community_chat: {
        Args: { p_community_id: string }
        Returns: string
      }
      claim_onboarding_bonus: {
        Args: Record<string, never>
        Returns: void
      }
      touch_activity_streak: {
        Args: Record<string, never>
        Returns: void
      }
    }
  }
}
