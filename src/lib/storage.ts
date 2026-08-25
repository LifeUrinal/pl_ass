import { get, set, del } from 'idb-keyval'
import type { ProjectDataSet } from '../types'

const KEY = 'prosjektokonomi:dataset:v1'

export async function loadDataset(): Promise<ProjectDataSet | undefined> {
  return get(KEY)
}

export async function saveDataset(data: ProjectDataSet): Promise<void> {
  await set(KEY, data)
}

export async function clearDataset(): Promise<void> {
  await del(KEY)
}

export const EMPTY_DATASET: ProjectDataSet = {
  faktureringsplan: [],
  endringslogg: [],
  beslutningsplan: [],
  innkjopsplan: [],
  prosjektinfo: [],
  fakturaer: [],
  meta: {},
}
