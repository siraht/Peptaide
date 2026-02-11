import type { FormulationEnriched } from '@/lib/repos/formulationsRepo'
import type { InventoryStatusRow } from '@/lib/repos/inventoryStatusRepo'

export type VialSelectorFormulation = {
  id: string
  name: string
  routeName: string
  deviceName: string | null
  activeVialCount: number
  plannedVialCount: number
  totalVialCount: number
}

export type VialSelectorSubstance = {
  id: string
  name: string
  formulationCount: number
  activeVialCount: number
  plannedVialCount: number
  totalVialCount: number
  formulations: VialSelectorFormulation[]
}

type VialCounts = {
  active: number
  planned: number
  total: number
}

function compareLabel(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

export function buildVialSelectorSubstances(
  formulations: FormulationEnriched[],
  inventory: InventoryStatusRow[],
): VialSelectorSubstance[] {
  const countsByFormulation = new Map<string, VialCounts>()

  for (const row of inventory) {
    const formulationId = row.formulation_id
    if (!formulationId) continue

    const existing = countsByFormulation.get(formulationId) ?? { active: 0, planned: 0, total: 0 }
    existing.total += 1
    if (row.status === 'active') existing.active += 1
    if (row.status === 'planned') existing.planned += 1
    countsByFormulation.set(formulationId, existing)
  }

  const grouped = new Map<string, VialSelectorSubstance>()

  for (const entry of formulations) {
    const substanceId = entry.formulation.substance_id
    const substanceName = entry.substance?.display_name ?? 'Unknown substance'

    const formulationCounts = countsByFormulation.get(entry.formulation.id) ?? { active: 0, planned: 0, total: 0 }

    const formulation: VialSelectorFormulation = {
      id: entry.formulation.id,
      name: entry.formulation.name,
      routeName: entry.route?.name ?? 'Unknown route',
      deviceName: entry.device?.name ?? null,
      activeVialCount: formulationCounts.active,
      plannedVialCount: formulationCounts.planned,
      totalVialCount: formulationCounts.total,
    }

    const existing = grouped.get(substanceId)
    if (existing) {
      existing.formulations.push(formulation)
      continue
    }

    grouped.set(substanceId, {
      id: substanceId,
      name: substanceName,
      formulationCount: 0,
      activeVialCount: 0,
      plannedVialCount: 0,
      totalVialCount: 0,
      formulations: [formulation],
    })
  }

  const substances = Array.from(grouped.values())

  for (const substance of substances) {
    substance.formulations.sort((a, b) => {
      const routeCmp = compareLabel(a.routeName, b.routeName)
      if (routeCmp !== 0) return routeCmp
      return compareLabel(a.name, b.name)
    })

    substance.formulationCount = substance.formulations.length
    substance.activeVialCount = substance.formulations.reduce((sum, formulation) => sum + formulation.activeVialCount, 0)
    substance.plannedVialCount = substance.formulations.reduce((sum, formulation) => sum + formulation.plannedVialCount, 0)
    substance.totalVialCount = substance.formulations.reduce((sum, formulation) => sum + formulation.totalVialCount, 0)
  }

  substances.sort((a, b) => compareLabel(a.name, b.name))
  return substances
}
