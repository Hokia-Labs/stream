import { Option } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, it } from 'vitest'

import {
  accomplishmentSummaryDocument,
  do254Files,
  problemReports,
  verificationResultsDocument,
} from './do254'
import { type Model, initialModel, update } from './main'
import { Message } from './message'
import {
  affectedSubsystems,
  hrdDocument,
  twinChanges,
  twinPackageFiles,
  twinRevision,
} from './twin'
import { crc32, createZip } from './zip'

const ready: Model = modifyFields(initialModel, { storage: () => 'Ready' })
const loaded = update(ready, Message.ClickedLoadTwinScenario()).model
const revB = update(
  loaded,
  Message.ClickedInstallTwinRevision({ revision: 'B' }),
).model

describe('digital twin', () => {
  it('loads the power-supply scenario at Rev A without changes', () => {
    expect(twinRevision(loaded.workspace.requirements)).toBe('A')
    expect(twinChanges(loaded.workspace.requirements)).toHaveLength(0)
    expect(
      update(loaded, Message.ClickedLoadTwinScenario()).model.workspace
        .requirements,
    ).toHaveLength(loaded.workspace.requirements.length)
  })

  it('placing Rev B revises requirements and the subsystems they touch', () => {
    const changes = twinChanges(revB.workspace.requirements)
    expect(twinRevision(revB.workspace.requirements)).toBe('B')
    expect(changes).toHaveLength(7)
    expect(changes.every(change => change.status !== 'Verified')).toBe(true)
    expect(affectedSubsystems(changes).map(item => item.name)).toEqual([
      'Electrical power',
      'Thermal management',
      'Structures',
      'Verification',
    ])
    expect(revB.twinFocus).toBe('Aft bay')
  })

  it('reverting to Rev A restores the baseline text', () => {
    const reverted = update(
      revB,
      Message.ClickedInstallTwinRevision({ revision: 'A' }),
    ).model
    expect(twinChanges(reverted.workspace.requirements)).toHaveLength(0)
  })

  it('requires all three reviews before packaging', () => {
    const blocked = update(revB, Message.ClickedGenerateTwinPackage())
    expect(blocked.commands ?? []).toHaveLength(0)
    const reviewed = (
      ['Requirements', 'Thermal', 'Mechanical'] as const
    ).reduce(
      (model, item) => update(model, Message.ToggledTwinReview({ item })).model,
      revB,
    )
    const started = update(reviewed, Message.ClickedGenerateTwinPackage())
    expect(started.commands).toHaveLength(1)
    expect(started.model.isGeneratingTwinPackage).toBe(true)
    const done = update(
      started.model,
      Message.GeneratedTwinPackage({
        name: 'HRD-PSU-001-RevB-package.zip',
        digest: 'abc',
        bytes: 10,
        files: ['HRD-PSU-001-RevB.md'],
      }),
    ).model
    const sent = update(done, Message.ClickedMarkTwinPackageSent()).model
    expect(Option.exists(sent.maybeTwinPackage, item => item.isSent)).toBe(true)
  })

  it('writes an HRD with the standard sections and the change record', () => {
    const document = hrdDocument(revB.workspace.requirements, '2026-10-03')
    for (const heading of [
      '## 1. Introduction & scope',
      '## 4. Requirements',
      '## 8. Verification & validation',
      '## 9. Traceability matrix',
      '## 11. Change record',
      '## 12. Review & sign-off',
    ]) {
      expect(document).toContain(heading)
    }
    expect(document).toContain('45 kW continuous')
    expect(document).toContain('SAMPLE')
    expect(document).toContain('Declassify On: 20511003')
    expect(document.startsWith('**SECRET//NOFORN**')).toBe(true)
    expect(
      twinPackageFiles(revB.workspace.requirements, '2026-10-03', []).map(
        file => file.name,
      ),
    ).toEqual([
      'HRD-PSU-001-RevB.md',
      'traceability.csv',
      'analysis-SAMPLE.csv',
      'change-record.json',
    ])
  })

  it('writes the DO-254 data for Rev B', () => {
    const requirements = revB.workspace.requirements
    expect(
      do254Files(requirements, '2026-10-03').map(file => file.name),
    ).toEqual([
      'HAS-PSU-001-RevB.md',
      'HCI-PSU-001-RevB.md',
      'HVR-PSU-001-RevB.md',
      'CIA-PSU-001-RevB.md',
      'problem-reports.csv',
    ])
    const has = accomplishmentSummaryDocument(requirements, '2026-10-03')
    expect(has).toContain('DO-254 §10.9')
    expect(has).toContain('Compliance is not yet claimed')
    expect(has.startsWith('**SECRET//NOFORN**')).toBe(true)
    expect(problemReports(requirements).map(item => item.id)).toContain(
      'PR-PSU-0141',
    )
    expect(problemReports(loaded.workspace.requirements)).toEqual([])
    expect(verificationResultsDocument(requirements, '2026-10-03')).toContain(
      'Not yet run on this configuration',
    )
  })

  it('builds a stored zip archive', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const archive = createZip(
      [{ name: 'a.txt', data: new TextEncoder().encode('hello') }],
      new Date(2026, 9, 3, 12, 0, 0),
    )
    const view = new DataView(archive.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(archive.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(archive.length - 12, true)).toBe(1)
  })
})
