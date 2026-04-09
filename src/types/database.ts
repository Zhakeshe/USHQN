export type UserRole = 'pupil' | 'student' | 'parent'
export type ListingKind = 'good' | 'service'

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
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string
          display_name?: string
          role?: UserRole
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
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
          created_at: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          title: string
          description?: string | null
          format_text?: string | null
        }
        Update: Partial<
          Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'owner_id' | 'created_at'>
        >
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
        }
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string
          created_at: string
        }
        Insert: {
          conversation_id: string
          sender_id: string
          body: string
        }
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
    }
  }
}
