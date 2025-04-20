export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          location: string | null
          vault_id: string
          balance: number
          escrow_balance: number
          created_at: string
          unread_transactions: string[]
        }
        Insert: {
          id: string
          name: string
          email: string
          phone?: string | null
          location?: string | null
          vault_id: string
          balance?: number
          escrow_balance?: number
          created_at?: string
          unread_transactions?: string[]
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          location?: string | null
          vault_id?: string
          balance?: number
          escrow_balance?: number
          created_at?: string
          unread_transactions?: string[]
        }
      }
      transactions: {
        Row: {
          id: string
          vtid: string
          sender_id: string
          receiver_id: string
          amount: number
          status: 'pending' | 'accepted' | 'completed' | 'cancelled'
          conditions: Json
          time_limit: number
          created_at: string
          accepted_at: string | null
          completed_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          vtid?: string
          sender_id: string
          receiver_id: string
          amount: number
          status: 'pending' | 'accepted' | 'completed' | 'cancelled'
          conditions?: Json
          time_limit: number
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          vtid?: string
          sender_id?: string
          receiver_id?: string
          amount?: number
          status?: 'pending' | 'accepted' | 'completed' | 'cancelled'
          conditions?: Json
          time_limit?: number
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
      }
    }
    Functions: {
      generate_vid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_vtid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      process_expired_transactions: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}