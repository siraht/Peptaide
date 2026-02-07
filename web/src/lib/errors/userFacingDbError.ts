export function toUserFacingDbErrorMessage(raw: string): string | null {
  // Unique constraints for common reference-data tables.
  if (raw.includes('substances_user_canonical_name_key')) {
    return 'A substance with this canonical name already exists.'
  }
  if (raw.includes('routes_user_name_key')) {
    return 'A route with this name already exists.'
  }
  if (raw.includes('devices_user_name_key')) {
    return 'A device with this name already exists.'
  }
  if (raw.includes('vendors_user_name_key')) {
    return 'A vendor with this name already exists.'
  }

  // More specific uniqueness constraints.
  if (raw.includes('formulations_user_substance_route_name_key')) {
    return 'A formulation with this name already exists for that substance and route.'
  }
  if (raw.includes('formulations_one_default_per_route_key')) {
    return 'A default formulation already exists for this substance and route. Disable "default for this substance+route" on one of them.'
  }
  if (raw.includes('formulation_components_user_formulation_component_key')) {
    return 'A component with this name already exists for this formulation.'
  }
  if (raw.includes('device_calibrations_user_device_route_label_key')) {
    return 'A calibration already exists for this device, route, and unit label.'
  }
  if (raw.includes('substance_aliases_user_alias_key')) {
    return 'That alias already exists.'
  }
  if (raw.includes('evidence_sources_user_source_type_citation_key')) {
    return 'That evidence source already exists (same type and citation).'
  }

  // Domain-specific integrity errors.
  if (
    raw.includes('order_items.substance_id') &&
    raw.includes('does not match formulations.substance_id')
  ) {
    return 'The selected formulation does not match the selected substance.'
  }

  // Distribution value-type enforcement triggers.
  if (raw.includes('expected distributions.value_type=fraction')) {
    return 'Selected distribution must have value type "fraction".'
  }
  if (raw.includes('expected distributions.value_type=multiplier')) {
    return 'Selected distribution must have value type "multiplier".'
  }
  if (raw.includes('expected distributions.value_type=volume_ml_per_unit')) {
    return 'Selected distribution must have value type "volume_ml_per_unit".'
  }

  // Distributions table constraints (avoid leaking constraint names).
  if (raw.includes('distributions_name_not_blank')) {
    return 'Distribution name is required.'
  }
  if (raw.includes('distributions_quality_score_range')) {
    return 'quality_score must be between 0 and 5.'
  }
  if (raw.includes('distributions_parameterization')) {
    return 'Distribution parameters are invalid for the selected distribution type.'
  }
  if (raw.includes('distributions_value_type_fraction_bounds')) {
    return 'Fraction distributions must be within [0,1].'
  }
  if (raw.includes('distributions_value_type_multiplier_bounds')) {
    return 'Multiplier distributions must be >= 0.'
  }
  if (raw.includes('distributions_value_type_volume_bounds')) {
    return 'volume_ml_per_unit distributions must be > 0.'
  }

  return null
}
