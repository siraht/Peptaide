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
      administration_events: {
        Row: {
          cost_usd: number | null
          created_at: string
          cycle_instance_id: string | null
          deleted_at: string | null
          dose_mass_mg: number | null
          dose_volume_ml: number | null
          eff_cns_p05_mg: number | null
          eff_cns_p50_mg: number | null
          eff_cns_p95_mg: number | null
          eff_systemic_p05_mg: number | null
          eff_systemic_p50_mg: number | null
          eff_systemic_p95_mg: number | null
          formulation_id: string
          id: string
          input_kind: Database["public"]["Enums"]["input_kind_t"]
          input_text: string
          input_unit: string | null
          input_value: number | null
          mc_n: number | null
          mc_seed: number | null
          model_snapshot: Json | null
          notes: string | null
          tags: string[]
          ts: string
          updated_at: string
          user_id: string
          vial_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          cycle_instance_id?: string | null
          deleted_at?: string | null
          dose_mass_mg?: number | null
          dose_volume_ml?: number | null
          eff_cns_p05_mg?: number | null
          eff_cns_p50_mg?: number | null
          eff_cns_p95_mg?: number | null
          eff_systemic_p05_mg?: number | null
          eff_systemic_p50_mg?: number | null
          eff_systemic_p95_mg?: number | null
          formulation_id: string
          id?: string
          input_kind?: Database["public"]["Enums"]["input_kind_t"]
          input_text: string
          input_unit?: string | null
          input_value?: number | null
          mc_n?: number | null
          mc_seed?: number | null
          model_snapshot?: Json | null
          notes?: string | null
          tags?: string[]
          ts: string
          updated_at?: string
          user_id?: string
          vial_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          cycle_instance_id?: string | null
          deleted_at?: string | null
          dose_mass_mg?: number | null
          dose_volume_ml?: number | null
          eff_cns_p05_mg?: number | null
          eff_cns_p50_mg?: number | null
          eff_cns_p95_mg?: number | null
          eff_systemic_p05_mg?: number | null
          eff_systemic_p50_mg?: number | null
          eff_systemic_p95_mg?: number | null
          formulation_id?: string
          id?: string
          input_kind?: Database["public"]["Enums"]["input_kind_t"]
          input_text?: string
          input_unit?: string | null
          input_value?: number | null
          mc_n?: number | null
          mc_seed?: number | null
          model_snapshot?: Json | null
          notes?: string | null
          tags?: string[]
          ts?: string
          updated_at?: string
          user_id?: string
          vial_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "cycle_instances"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_summary"
            referencedColumns: ["user_id", "cycle_instance_id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_status"
            referencedColumns: ["user_id", "vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_summary"
            referencedColumns: ["user_id", "active_vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "vials"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
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
      event_revisions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          new_values: Json | null
          old_values: Json
          reason: string | null
          revised_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          new_values?: Json | null
          old_values: Json
          reason?: string | null
          revised_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json
          reason?: string | null
          revised_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_revisions_event_fk"
            columns: ["user_id", "event_id"]
            isOneToOne: false
            referencedRelation: "administration_events"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "event_revisions_event_fk"
            columns: ["user_id", "event_id"]
            isOneToOne: false
            referencedRelation: "v_event_enriched"
            referencedColumns: ["user_id", "event_id"]
          },
          {
            foreignKeyName: "event_revisions_event_fk"
            columns: ["user_id", "event_id"]
            isOneToOne: false
            referencedRelation: "v_events_today"
            referencedColumns: ["user_id", "event_id"]
          },
        ]
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
            foreignKeyName: "formulation_components_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
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
            foreignKeyName: "formulation_modifier_specs_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
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
            foreignKeyName: "order_items_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
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
            foreignKeyName: "vials_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
          {
            foreignKeyName: "vials_order_item_fk"
            columns: ["user_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "vials_order_item_fk"
            columns: ["user_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_item_vial_counts"
            referencedColumns: ["user_id", "order_item_id"]
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
      v_cycle_summary: {
        Row: {
          administered_mg_total: number | null
          break_to_next_cycle_days: number | null
          cycle_instance_id: string | null
          cycle_length_days: number | null
          cycle_number: number | null
          eff_cns_p05_mg_total: number | null
          eff_cns_p50_mg_total: number | null
          eff_cns_p95_mg_total: number | null
          eff_systemic_p05_mg_total: number | null
          eff_systemic_p50_mg_total: number | null
          eff_systemic_p95_mg_total: number | null
          end_ts: string | null
          event_count: number | null
          goal: string | null
          notes: string | null
          recommended_break_days_max: number | null
          recommended_break_days_min: number | null
          recommended_cycle_days_max: number | null
          recommended_cycle_days_min: number | null
          start_ts: string | null
          status: Database["public"]["Enums"]["cycle_status_t"] | null
          substance_id: string | null
          substance_name: string | null
          user_id: string | null
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
      v_daily_totals_admin: {
        Row: {
          administered_mg: number | null
          day_local: string | null
          event_count: number | null
          substance_id: string | null
          substance_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_daily_totals_effective_cns: {
        Row: {
          day_local: string | null
          eff_cns_p05_mg: number | null
          eff_cns_p50_mg: number | null
          eff_cns_p95_mg: number | null
          event_count: number | null
          substance_id: string | null
          substance_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_daily_totals_effective_systemic: {
        Row: {
          day_local: string | null
          eff_systemic_p05_mg: number | null
          eff_systemic_p50_mg: number | null
          eff_systemic_p95_mg: number | null
          event_count: number | null
          substance_id: string | null
          substance_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_event_enriched: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          cycle_instance_id: string | null
          deleted_at: string | null
          device_id: string | null
          device_name: string | null
          dose_mass_mg: number | null
          dose_volume_ml: number | null
          eff_cns_p05_mg: number | null
          eff_cns_p50_mg: number | null
          eff_cns_p95_mg: number | null
          eff_systemic_p05_mg: number | null
          eff_systemic_p50_mg: number | null
          eff_systemic_p95_mg: number | null
          event_id: string | null
          formulation_id: string | null
          formulation_name: string | null
          input_kind: Database["public"]["Enums"]["input_kind_t"] | null
          input_text: string | null
          input_unit: string | null
          input_value: number | null
          mc_n: number | null
          mc_seed: number | null
          model_snapshot: Json | null
          notes: string | null
          route_id: string | null
          route_name: string | null
          substance_id: string | null
          substance_name: string | null
          tags: string[] | null
          ts: string | null
          updated_at: string | null
          user_id: string | null
          vial_id: string | null
          vial_status: Database["public"]["Enums"]["vial_status_t"] | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "cycle_instances"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_summary"
            referencedColumns: ["user_id", "cycle_instance_id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_status"
            referencedColumns: ["user_id", "vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_summary"
            referencedColumns: ["user_id", "active_vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "vials"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      v_events_today: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          cycle_instance_id: string | null
          deleted_at: string | null
          device_id: string | null
          device_name: string | null
          dose_mass_mg: number | null
          dose_volume_ml: number | null
          eff_cns_p05_mg: number | null
          eff_cns_p50_mg: number | null
          eff_cns_p95_mg: number | null
          eff_systemic_p05_mg: number | null
          eff_systemic_p50_mg: number | null
          eff_systemic_p95_mg: number | null
          event_id: string | null
          formulation_id: string | null
          formulation_name: string | null
          input_kind: Database["public"]["Enums"]["input_kind_t"] | null
          input_text: string | null
          input_unit: string | null
          input_value: number | null
          mc_n: number | null
          mc_seed: number | null
          model_snapshot: Json | null
          notes: string | null
          route_id: string | null
          route_name: string | null
          substance_id: string | null
          substance_name: string | null
          tags: string[] | null
          ts: string | null
          updated_at: string | null
          user_id: string | null
          vial_id: string | null
          vial_status: Database["public"]["Enums"]["vial_status_t"] | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "cycle_instances"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_cycle_fk"
            columns: ["user_id", "cycle_instance_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_summary"
            referencedColumns: ["user_id", "cycle_instance_id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "administration_events_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_status"
            referencedColumns: ["user_id", "vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_summary"
            referencedColumns: ["user_id", "active_vial_id"]
          },
          {
            foreignKeyName: "administration_events_vial_fk"
            columns: ["user_id", "vial_id"]
            isOneToOne: false
            referencedRelation: "vials"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      v_inventory_status: {
        Row: {
          avg_daily_administered_mg_14d: number | null
          closed_at: string | null
          concentration_mg_per_ml_effective: number | null
          content_mass_mg: number | null
          content_mass_unit: string | null
          content_mass_value: number | null
          cost_usd: number | null
          formulation_id: string | null
          formulation_name: string | null
          lot: string | null
          notes: string | null
          opened_at: string | null
          received_at: string | null
          remaining_mass_mg: number | null
          remaining_volume_ml: number | null
          route_id: string | null
          route_name: string | null
          runway_days_estimate_mg: number | null
          status: Database["public"]["Enums"]["vial_status_t"] | null
          substance_id: string | null
          substance_name: string | null
          total_volume_ml: number | null
          total_volume_unit: string | null
          total_volume_value: number | null
          used_mass_mg: number | null
          used_volume_ml: number | null
          user_id: string | null
          vial_id: string | null
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
            foreignKeyName: "vials_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
        ]
      }
      v_inventory_summary: {
        Row: {
          active_content_mass_mg: number | null
          active_lot: string | null
          active_remaining_mass_mg: number | null
          active_used_mass_mg: number | null
          active_vial_id: string | null
          avg_daily_administered_mg_14d: number | null
          formulation_id: string | null
          formulation_name: string | null
          route_id: string | null
          route_name: string | null
          runway_days_estimate_active_mg: number | null
          runway_days_estimate_total_mg: number | null
          substance_id: string | null
          substance_name: string | null
          total_content_mass_mg: number | null
          total_cost_usd_known: number | null
          total_remaining_mass_mg: number | null
          total_used_mass_mg: number | null
          user_id: string | null
          vial_count_cost_known: number | null
          vial_count_total: number | null
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
            foreignKeyName: "vials_formulation_fk"
            columns: ["user_id", "formulation_id"]
            isOneToOne: false
            referencedRelation: "v_model_coverage"
            referencedColumns: ["user_id", "formulation_id"]
          },
        ]
      }
      v_model_coverage: {
        Row: {
          device_id: string | null
          device_name: string | null
          formulation_id: string | null
          formulation_name: string | null
          has_component_fallback_modifiers: boolean | null
          has_component_modifiers: boolean | null
          has_formulation_modifiers: boolean | null
          missing_any_device_calibration: boolean | null
          missing_base_cns: boolean | null
          missing_base_systemic: boolean | null
          route_id: string | null
          route_name: string | null
          substance_id: string | null
          substance_name: string | null
          supports_device_calibration: boolean | null
          user_id: string | null
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
      v_order_item_vial_counts: {
        Row: {
          event_cost_usd_known_count: number | null
          event_cost_usd_sum: number | null
          event_count_total: number | null
          order_item_id: string | null
          user_id: string | null
          vial_cost_usd_known_count: number | null
          vial_cost_usd_sum: number | null
          vial_count_active: number | null
          vial_count_closed: number | null
          vial_count_discarded: number | null
          vial_count_planned: number | null
          vial_count_total: number | null
        }
        Relationships: []
      }
      v_spend_daily_weekly_monthly: {
        Row: {
          period_kind: string | null
          period_start_date: string | null
          spend_usd: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      safe_timezone: { Args: { tz: string }; Returns: string }
      split_cycle_at_event: {
        Args: { cycle_instance_id: string; event_id: string }
        Returns: string
      }
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

