import { Schema } from 'effect'

export const ExecutorStatus = Schema.Struct({
  state: Schema.Literals(['Ready', 'Locked', 'Unconfigured']),
  model: Schema.String,
  gateway: Schema.String,
})
export type ExecutorStatus = typeof ExecutorStatus.Type
export const RunControl = Schema.Literals(['Hold', 'Resume', 'Cancel'])
export type RunControl = typeof RunControl.Type
export const maxAgents = 8
export const maxArtifacts = 200
export const maxRequestBytes = 512_000
export const maxRunMillis = 10 * 60 * 1000
