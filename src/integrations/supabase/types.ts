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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_temporary: boolean
          nome: string
          observacoes: string | null
          referencia: string | null
          telefone: string
          total_tentativas_sem_resposta: number
          ultima_conversa: string | null
          ultima_interacao: string | null
          ultimo_trabalho_data: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_temporary?: boolean
          nome: string
          observacoes?: string | null
          referencia?: string | null
          telefone: string
          total_tentativas_sem_resposta?: number
          ultima_conversa?: string | null
          ultima_interacao?: string | null
          ultimo_trabalho_data?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_temporary?: boolean
          nome?: string
          observacoes?: string | null
          referencia?: string | null
          telefone?: string
          total_tentativas_sem_resposta?: number
          ultima_conversa?: string | null
          ultima_interacao?: string | null
          ultimo_trabalho_data?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          contact_id: string
          created_at: string
          first_response_at: string | null
          id: string
          last_customer_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          status_atendimento: string
          updated_at: string
          whatsapp_number_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          status_atendimento?: string
          updated_at?: string
          whatsapp_number_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          status_atendimento?: string
          updated_at?: string
          whatsapp_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_number_id_fkey"
            columns: ["whatsapp_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          evolution_api_key: string
          evolution_api_url: string
          id: string
          updated_at: string
          updated_by: string | null
          webhook_secret: string
          webhook_url: string
        }
        Insert: {
          evolution_api_key?: string
          evolution_api_url?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string
          webhook_url?: string
        }
        Update: {
          evolution_api_key?: string
          evolution_api_url?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string
          webhook_url?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conteudo: string
          conversation_id: string
          created_at: string
          data_envio: string
          id: string
          tipo: Database["public"]["Enums"]["message_type"]
          user_id: string | null
          whatsapp_number_id: string
        }
        Insert: {
          conteudo: string
          conversation_id: string
          created_at?: string
          data_envio?: string
          id?: string
          tipo: Database["public"]["Enums"]["message_type"]
          user_id?: string | null
          whatsapp_number_id: string
        }
        Update: {
          conteudo?: string
          conversation_id?: string
          created_at?: string
          data_envio?: string
          id?: string
          tipo?: Database["public"]["Enums"]["message_type"]
          user_id?: string | null
          whatsapp_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_whatsapp_number_id_fkey"
            columns: ["whatsapp_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_admin: boolean
          is_system: boolean
          nome: string
          pode_enviar_mensagens: boolean
          pode_gerenciar_automacoes: boolean
          pode_gerenciar_contatos: boolean
          pode_gerenciar_integracoes: boolean
          pode_gerenciar_numeros: boolean
          pode_gerenciar_usuarios: boolean
          pode_reatribuir_conversas: boolean
          pode_ver_automacoes: boolean
          pode_ver_contatos: boolean
          pode_ver_dashboard: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          nome: string
          pode_enviar_mensagens?: boolean
          pode_gerenciar_automacoes?: boolean
          pode_gerenciar_contatos?: boolean
          pode_gerenciar_integracoes?: boolean
          pode_gerenciar_numeros?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_reatribuir_conversas?: boolean
          pode_ver_automacoes?: boolean
          pode_ver_contatos?: boolean
          pode_ver_dashboard?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          nome?: string
          pode_enviar_mensagens?: boolean
          pode_gerenciar_automacoes?: boolean
          pode_gerenciar_contatos?: boolean
          pode_gerenciar_integracoes?: boolean
          pode_gerenciar_numeros?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_reatribuir_conversas?: boolean
          pode_ver_automacoes?: boolean
          pode_ver_contatos?: boolean
          pode_ver_dashboard?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_whatsapp_numbers: {
        Row: {
          created_at: string
          id: string
          user_id: string
          whatsapp_number_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          whatsapp_number_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          whatsapp_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_whatsapp_numbers_whatsapp_number_id_fkey"
            columns: ["whatsapp_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_numbers: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          nome: string
          phone_number: string | null
          sla_minutes: number
          status: Database["public"]["Enums"]["whatsapp_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          nome: string
          phone_number?: string | null
          sla_minutes?: number
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          nome?: string
          phone_number?: string | null
          sla_minutes?: number
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_reassign_conversations: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      user_can_access_number: {
        Args: { _number_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "atendente"
      attendance_status: "pendente" | "em_atendimento" | "finalizado"
      conversation_status: "aberto" | "fechado"
      message_type: "entrada" | "saida"
      user_status: "ativo" | "inativo"
      whatsapp_status: "conectado" | "desconectado"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "atendente"],
      attendance_status: ["pendente", "em_atendimento", "finalizado"],
      conversation_status: ["aberto", "fechado"],
      message_type: ["entrada", "saida"],
      user_status: ["ativo", "inativo"],
      whatsapp_status: ["conectado", "desconectado"],
    },
  },
} as const
