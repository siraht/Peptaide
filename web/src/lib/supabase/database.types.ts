export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      bioavailability_specs: {
        Row: {
          base_fraction_dist_id: string
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at: string
          deleted_at: string | null
          evidence_source_id: string | null
          id: string
          notes: string | null
          route_id: string
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_fraction_dist_id: string
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          evidence_source_id?: string | null
          id?: string
          notes?: string | null
          route_id: string
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          base_fraction_dist_id?: string
          compartment?: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          evidence_source_id?: string | null
          id?: string
          notes?: string | null
          route_id?: string
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bioavailability_specs_base_fraction_fk"
            columns: ["user_id", "base_fraction_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "bioavailability_specs_evidence_source_fk"
            columns: ["user_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "bioavailability_specs_route_fk"
            columns: ["user_id", "route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "bioavailability_specs_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      component_modifier_specs: {
        Row: {
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at: string
          deleted_at: string | null
          formulation_component_id: string
          id: string
          multiplier_dist_id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          formulation_component_id: string
          id?: string
          multiplier_dist_id: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          compartment?: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          formulation_component_id?: string
          id?: string
          multiplier_dist_id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_modifier_specs_component_fk"
            columns: ["user_id", "formulation_component_id"]
            isOneToOne: false
            referencedRelation: "formulation_components"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "component_modifier_specs_multiplier_fk"
            columns: ["user_id", "multiplier_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      cycle_instances: {
        Row: {
          created_at: string
          cycle_number: number
          deleted_at: string | null
          end_ts: string | null
          goal: string | null
          id: string
          notes: string | null
          start_ts: string
          status: Database["public"]["Enums"]["cycle_status_t"]
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_number: number
          deleted_at?: string | null
          end_ts?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          start_ts: string
          status?: Database["public"]["Enums"]["cycle_status_t"]
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          deleted_at?: string | null
          end_ts?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          start_ts?: string
          status?: Database["public"]["Enums"]["cycle_status_t"]
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_instances_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      cycle_rules: {
        Row: {
          auto_start_first_cycle: boolean
          created_at: string
          deleted_at: string | null
          gap_days_to_suggest_new_cycle: number
          id: string
          notes: string | null
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_start_first_cycle?: boolean
          created_at?: string
          deleted_at?: string | null
          gap_days_to_suggest_new_cycle?: number
          id?: string
          notes?: string | null
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          auto_start_first_cycle?: boolean
          created_at?: string
          deleted_at?: string | null
          gap_days_to_suggest_new_cycle?: number
          id?: string
          notes?: string | null
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_rules_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      device_calibrations: {
        Row: {
          created_at: string
          deleted_at: string | null
          device_id: string
          id: string
          notes: string | null
          route_id: string
          unit_label: string
          updated_at: string
          user_id: string
          volume_ml_per_unit_dist_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          device_id: string
          id?: string
          notes?: string | null
          route_id: string
          unit_label: string
          updated_at?: string
          user_id?: string
          volume_ml_per_unit_dist_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          id?: string
          notes?: string | null
          route_id?: string
          unit_label?: string
          updated_at?: string
          user_id?: string
          volume_ml_per_unit_dist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_calibrations_device_fk"
            columns: ["user_id", "device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "device_calibrations_route_fk"
            columns: ["user_id", "route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "device_calibrations_volume_dist_fk"
            columns: ["user_id", "volume_ml_per_unit_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          default_unit: string
          deleted_at: string | null
          device_kind: Database["public"]["Enums"]["device_kind_t"]
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_unit: string
          deleted_at?: string | null
          device_kind?: Database["public"]["Enums"]["device_kind_t"]
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          default_unit?: string
          deleted_at?: string | null
          device_kind?: Database["public"]["Enums"]["device_kind_t"]
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      distributions: {
        Row: {
          created_at: string
          deleted_at: string | null
          dist_type: Database["public"]["Enums"]["distribution_dist_type_t"]
          evidence_summary: string | null
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          p1: number | null
          p2: number | null
          p3: number | null
          quality_score: number
          units: string | null
          updated_at: string
          user_id: string
          value_type: Database["public"]["Enums"]["distribution_value_type_t"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dist_type: Database["public"]["Enums"]["distribution_dist_type_t"]
          evidence_summary?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          p1?: number | null
          p2?: number | null
          p3?: number | null
          quality_score?: number
          units?: string | null
          updated_at?: string
          user_id?: string
          value_type: Database["public"]["Enums"]["distribution_value_type_t"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dist_type?: Database["public"]["Enums"]["distribution_dist_type_t"]
          evidence_summary?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          p1?: number | null
          p2?: number | null
          p3?: number | null
          quality_score?: number
          units?: string | null
          updated_at?: string
          user_id?: string
          value_type?: Database["public"]["Enums"]["distribution_value_type_t"]
        }
        Relationships: []
      }
      evidence_sources: {
        Row: {
          citation: string
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          source_type: Database["public"]["Enums"]["evidence_source_type_t"]
          updated_at: string
          user_id: string
        }
        Insert: {
          citation: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          source_type: Database["public"]["Enums"]["evidence_source_type_t"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          citation?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          source_type?: Database["public"]["Enums"]["evidence_source_type_t"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      formulation_components: {
        Row: {
          component_name: string
          created_at: string
          deleted_at: string | null
          formulation_id: string
          id: string
          modifier_dist_id: string | null
          notes: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          component_name: string
          created_at?: string
          deleted_at?: string | null
          formulation_id: string
          id?: string
          modifier_dist_id?: string | null
          notes?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          component_name?: string
          created_at?: string
          deleted_at?: string | null
          formulation_id?: string
          id?: string
          modifier_dist_id?: string | null
          notes?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulation_components_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "formulation_components_modifier_dist_fk"
            columns: ["user_id", "modifier_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      formulation_modifier_specs: {
        Row: {
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at: string
          deleted_at: string | null
          formulation_id: string
          id: string
          multiplier_dist_id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compartment: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          formulation_id: string
          id?: string
          multiplier_dist_id: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          compartment?: Database["public"]["Enums"]["compartment_t"]
          created_at?: string
          deleted_at?: string | null
          formulation_id?: string
          id?: string
          multiplier_dist_id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulation_modifier_specs_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "formulation_modifier_specs_multiplier_fk"
            columns: ["user_id", "multiplier_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      formulations: {
        Row: {
          created_at: string
          deleted_at: string | null
          device_id: string | null
          id: string
          is_default_for_route: boolean
          name: string
          notes: string | null
          route_id: string
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          is_default_for_route?: boolean
          name: string
          notes?: string | null
          route_id: string
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          is_default_for_route?: boolean
          name?: string
          notes?: string | null
          route_id?: string
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulations_device_fk"
            columns: ["user_id", "device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "formulations_route_fk"
            columns: ["user_id", "route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "formulations_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          expected_vials: number | null
          formulation_id: string | null
          id: string
          notes: string | null
          order_id: string
          price_total_usd: number | null
          qty: number
          substance_id: string
          unit_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          expected_vials?: number | null
          formulation_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          price_total_usd?: number | null
          qty: number
          substance_id: string
          unit_label: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          expected_vials?: number | null
          formulation_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          price_total_usd?: number | null
          qty?: number
          substance_id?: string
          unit_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "order_items_order_fk"
            columns: ["user_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "order_items_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          ordered_at: string
          shipping_cost_usd: number | null
          total_cost_usd: number | null
          tracking_code: string | null
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          shipping_cost_usd?: number | null
          total_cost_usd?: number | null
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          shipping_cost_usd?: number | null
          total_cost_usd?: number | null
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_vendor_fk"
            columns: ["user_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          cycle_gap_default_days: number
          default_mass_unit: string
          default_simulation_n: number
          default_volume_unit: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_gap_default_days?: number
          default_mass_unit?: string
          default_simulation_n?: number
          default_volume_unit?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_gap_default_days?: number
          default_mass_unit?: string
          default_simulation_n?: number
          default_volume_unit?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          default_input_kind: Database["public"]["Enums"]["route_input_kind_t"]
          default_input_unit: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          supports_device_calibration: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_input_kind: Database["public"]["Enums"]["route_input_kind_t"]
          default_input_unit: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          supports_device_calibration?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          default_input_kind?: Database["public"]["Enums"]["route_input_kind_t"]
          default_input_unit?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          supports_device_calibration?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      substance_aliases: {
        Row: {
          alias: string
          created_at: string
          deleted_at: string | null
          id: string
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          alias?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substance_aliases_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      substance_recommendations: {
        Row: {
          category: Database["public"]["Enums"]["recommendation_category_t"]
          created_at: string
          deleted_at: string | null
          evidence_source_id: string | null
          id: string
          max_value: number | null
          min_value: number | null
          notes: string | null
          route_id: string | null
          substance_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["recommendation_category_t"]
          created_at?: string
          deleted_at?: string | null
          evidence_source_id?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          route_id?: string | null
          substance_id: string
          unit: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["recommendation_category_t"]
          created_at?: string
          deleted_at?: string | null
          evidence_source_id?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          route_id?: string | null
          substance_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substance_recommendations_evidence_source_fk"
            columns: ["user_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "substance_recommendations_route_fk"
            columns: ["user_id", "route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "substance_recommendations_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      substances: {
        Row: {
          canonical_name: string
          created_at: string
          deleted_at: string | null
          display_name: string
          family: string | null
          id: string
          notes: string | null
          target_compartment_default: Database["public"]["Enums"]["compartment_t"]
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          deleted_at?: string | null
          display_name: string
          family?: string | null
          id?: string
          notes?: string | null
          target_compartment_default?: Database["public"]["Enums"]["compartment_t"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          family?: string | null
          id?: string
          notes?: string | null
          target_compartment_default?: Database["public"]["Enums"]["compartment_t"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vials: {
        Row: {
          closed_at: string | null
          concentration_mg_per_ml: number | null
          content_mass_unit: string
          content_mass_value: number
          cost_usd: number | null
          created_at: string
          deleted_at: string | null
          formulation_id: string
          id: string
          lot: string | null
          notes: string | null
          opened_at: string | null
          order_item_id: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["vial_status_t"]
          substance_id: string
          total_volume_unit: string | null
          total_volume_value: number | null
          updated_at: string
          user_id: string
          volume_ml_per_unit_override_dist_id: string | null
        }
        Insert: {
          closed_at?: string | null
          concentration_mg_per_ml?: number | null
          content_mass_unit: string
          content_mass_value: number
          cost_usd?: number | null
          created_at?: string
          deleted_at?: string | null
          formulation_id: string
          id?: string
          lot?: string | null
          notes?: string | null
          opened_at?: string | null
          order_item_id?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["vial_status_t"]
          substance_id: string
          total_volume_unit?: string | null
          total_volume_value?: number | null
          updated_at?: string
          user_id?: string
          volume_ml_per_unit_override_dist_id?: string | null
        }
        Update: {
          closed_at?: string | null
          concentration_mg_per_ml?: number | null
          content_mass_unit?: string
          content_mass_value?: number
          cost_usd?: number | null
          created_at?: string
          deleted_at?: string | null
          formulation_id?: string
          id?: string
          lot?: string | null
          notes?: string | null
          opened_at?: string | null
          order_item_id?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["vial_status_t"]
          substance_id?: string
          total_volume_unit?: string | null
          total_volume_value?: number | null
          updated_at?: string
          user_id?: string
          volume_ml_per_unit_override_dist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vials_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "vials_order_item_fk"
            columns: ["user_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "vials_substance_fk"
            columns: ["user_id", "substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "vials_volume_override_dist_fk"
            columns: ["user_id", "volume_ml_per_unit_override_dist_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      compartment_t: "systemic" | "cns" | "both"
      cycle_status_t: "active" | "completed" | "abandoned"
      device_kind_t: "syringe" | "spray" | "dropper" | "pen" | "other"
      distribution_dist_type_t:
        | "point"
        | "uniform"
        | "triangular"
        | "lognormal"
        | "beta_pert"
      distribution_value_type_t:
        | "fraction"
        | "multiplier"
        | "volume_ml_per_unit"
        | "other"
      evidence_source_type_t:
        | "paper"
        | "label"
        | "clinical_guideline"
        | "vendor"
        | "anecdote"
        | "personal_note"
      input_kind_t: "mass" | "volume" | "device_units" | "iu" | "other"
      recommendation_category_t:
        | "cycle_length_days"
        | "break_length_days"
        | "dosing"
        | "frequency"
      route_input_kind_t: "mass" | "volume" | "device_units" | "iu"
      vial_status_t: "planned" | "active" | "closed" | "discarded"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      compartment_t: ["systemic", "cns", "both"],
      cycle_status_t: ["active", "completed", "abandoned"],
      device_kind_t: ["syringe", "spray", "dropper", "pen", "other"],
      distribution_dist_type_t: [
        "point",
        "uniform",
        "triangular",
        "lognormal",
        "beta_pert",
      ],
      distribution_value_type_t: [
        "fraction",
        "multiplier",
        "volume_ml_per_unit",
        "other",
      ],
      evidence_source_type_t: [
        "paper",
        "label",
        "clinical_guideline",
        "vendor",
        "anecdote",
        "personal_note",
      ],
      input_kind_t: ["mass", "volume", "device_units", "iu", "other"],
      recommendation_category_t: [
        "cycle_length_days",
        "break_length_days",
        "dosing",
        "frequency",
      ],
      route_input_kind_t: ["mass", "volume", "device_units", "iu"],
      vial_status_t: ["planned", "active", "closed", "discarded"],
    },
  },
} as const

