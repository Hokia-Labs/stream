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
  avionicsChange,
  budgetMargin,
  hrdDocument,
  isAvionicsUpgraded,
  loadBudget,
  requirementChecks,
  seedTwinArtifacts,
  swapTwinAvionics,
  teamcenterSync,
  twinChanges,
  twinPackageFiles,
  twinRevision,
} from './twin'
import { crc32, createZip } from './zip'

const ready: Model = modifyFields(initialModel, { storage: () => 'Ready' })
const loaded = update(ready, Message.ClickedLoadTwinScenario()).model
const approve = (model: Model): Model =>
  [
    Message.ClickedDraftTwinProposal(),
    Message.DraftedTwinProposal(),
    Message.OpenedBoardReview(),
    Message.ClickedApproveTwinProposal(),
  ].reduce((current, message) => update(current, message).model, model)
const revB = update(
  modifyFields(loaded, { twinProposal: () => 'Approved' }),
  Message.ClickedInstallTwinRevision({ revision: 'B' }),
).model

const pick = (model: Model, slot: 'Cockpit' | 'Power', id: string): Model =>
  [
    Message.OpenedTwinPartPicker({ slot }),
    Message.SelectedTwinCatalogItem({ id }),
    Message.ClickedInstallTwinPart(),
  ].reduce((current, message) => update(current, message).model, model)

describe('digital twin', () => {
  it('installs released parts picked from the Teamcenter catalog', () => {
    expect(
      twinRevision(pick(loaded, 'Power', 'MW-MPA-48-5').workspace.requirements),
    ).toBe('A')
    const swapped = pick(loaded, 'Cockpit', 'MW-AVN-2700')
    expect(isAvionicsUpgraded(swapped.workspace.requirements)).toBe(true)
    expect(
      twinRevision(
        pick(swapped, 'Power', 'MW-MPA-48-5').workspace.requirements,
      ),
    ).toBe('A')
    const upgraded = approve(swapped)
    expect(twinRevision(upgraded.workspace.requirements)).toBe('B')
    const restored = pick(upgraded, 'Power', 'MW-MPA-48-4').workspace
      .requirements
    expect(twinRevision(restored)).toBe('A')
    expect(isAvionicsUpgraded(restored)).toBe(true)
  })

  it('shows the avionics change exceeds Rev A margins and fits Rev B', () => {
    const rows = loadBudget()
    expect(rows.some(row => budgetMargin(row, 'A') < 0)).toBe(true)
    expect(
      rows.every(
        row => budgetMargin(row, 'B') >= avionicsChange.requiredMargin,
      ),
    ).toBe(true)
    expect(rows[1]?.demand.A).toBeCloseTo(10.2)
    expect(rows[1]?.capacity.A).toBe(9)
    expect(rows[3]?.demand.A).toBeCloseTo(0.537, 3)
  })

  it('loads the power-supply scenario at Rev A without changes', () => {
    expect(twinRevision(loaded.workspace.requirements)).toBe('A')
    expect(twinChanges(loaded.workspace.requirements)).toHaveLength(0)
    expect(
      update(loaded, Message.ClickedLoadTwinScenario()).model.workspace
        .requirements,
    ).toHaveLength(loaded.workspace.requirements.length)
  })

  it('swaps in the new avionics module before Rev B', () => {
    const swapped = update(loaded, Message.ClickedSwapTwinAvionics())
    const changes = twinChanges(swapped.model.workspace.requirements)
    expect(changes.map(change => change.artifact.id)).toEqual([
      'REQ-AVN-01',
      'REQ-PSU-01',
      'REQ-PSU-02',
      'REQ-PSU-03',
    ])
    expect(twinRevision(swapped.model.workspace.requirements)).toBe('A')
    expect(swapped.model.twinProposal).toBe('Drafting')
    expect(swapped.commands).toHaveLength(2)
  })

  it('installs Rev B only after an electrical engineer approves the proposal', () => {
    const swapped = update(loaded, Message.ClickedSwapTwinAvionics()).model
    expect(
      update(swapped, Message.ClickedApproveTwinProposal()).model.workspace
        .requirements,
    ).toBe(swapped.workspace.requirements)
    const pending = update(swapped, Message.DraftedTwinProposal()).model
    expect(pending.twinProposal).toBe('Pending')
    expect(twinRevision(pending.workspace.requirements)).toBe('A')

    const rejected = update(pending, Message.ClickedRejectTwinProposal()).model
    expect(rejected.twinProposal).toBe('Rejected')
    expect(twinRevision(rejected.workspace.requirements)).toBe('A')
    expect(
      update(rejected, Message.ClickedDraftTwinProposal()).model.twinProposal,
    ).toBe('Drafting')

    expect(
      twinRevision(
        update(pending, Message.ClickedApproveTwinProposal()).model.workspace
          .requirements,
      ),
    ).toBe('A')
    expect(
      twinRevision(
        update(pending, Message.ClickedInstallTwinRevision({ revision: 'B' }))
          .model.workspace.requirements,
      ),
    ).toBe('A')
    const reviewing = update(pending, Message.OpenedBoardReview()).model
    expect(reviewing.modal._tag).toBe('BoardReview')
    const edited = update(
      reviewing,
      Message.UpdatedTwinDesign({ index: 3, field: 'after', value: '60 A' }),
    ).model
    expect(edited.twinDesign[3]?.after).toBe('60 A')
    const approved = update(edited, Message.ClickedApproveTwinProposal()).model
    expect(approved.modal._tag).toBe('Closed')
    expect(
      approved.workspace.events.some(event =>
        event.includes('engineer-edited design'),
      ),
    ).toBe(true)
    expect(approved.twinProposal).toBe('Approved')
    expect(twinRevision(approved.workspace.requirements)).toBe('B')
    expect(
      approved.workspace.events.some(event =>
        event.includes('approved · Sarah Chen'),
      ),
    ).toBe(true)

    const running = update(approved, Message.ClickedRunTwinCheck())
    expect(running.model.twinCheck).toBe('Running')
    expect(running.commands).toHaveLength(1)
    const checked = update(running.model, Message.CompletedTwinCheck()).model
    expect(checked.twinCheck).toBe('Done')
    const reset = update(checked, Message.ClickedResetTwin()).model
    expect(twinChanges(reset.workspace.requirements)).toHaveLength(0)
    expect(reset.twinProposal).toBe('None')
    expect(requirementChecks('B').every(check => check.isPass)).toBe(true)
    expect(requirementChecks('A').some(check => !check.isPass)).toBe(true)
  })

  it('placing Rev B revises requirements and the subsystems they touch', () => {
    const changes = twinChanges(revB.workspace.requirements)
    expect(twinRevision(revB.workspace.requirements)).toBe('B')
    expect(changes).toHaveLength(8)
    expect(changes.every(change => change.status !== 'Verified')).toBe(true)
    expect(affectedSubsystems(changes).map(item => item.name)).toEqual([
      'Avionics',
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
    const drafted = update(
      started.model,
      Message.DraftedTwinReports({
        files: [
          { name: 'HRD-PSU-001-RevB.md', content: '# HRD', isEdited: false },
          { name: 'traceability.csv', content: 'ID', isEdited: false },
        ],
      }),
    ).model
    expect(drafted.twinReportTab).toBe('HRD-PSU-001-RevB.md')
    const edited = update(
      drafted,
      Message.EditedTwinReport({
        name: 'HRD-PSU-001-RevB.md',
        markdown: '# HRD edited',
      }),
    ).model
    expect(edited.twinReports[0]).toEqual({
      name: 'HRD-PSU-001-RevB.md',
      content: '# HRD edited',
      isEdited: true,
    })
    const downloading = update(edited, Message.ClickedDownloadTwinPackage())
    expect(downloading.commands).toHaveLength(1)
    const done = update(
      downloading.model,
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
    expect(document).toContain('12.0 kW continuous')
    expect(document).not.toContain('SAMPLE')
    expect(document).toContain('Declassify On: 20511003')
    expect(document.startsWith('**SECRET//NOFORN**')).toBe(true)
    expect(
      twinPackageFiles(revB.workspace.requirements, '2026-10-03', []).map(
        file => file.name,
      ),
    ).toEqual([
      'HRD-PSU-001-RevB.md',
      'traceability.csv',
      'analysis.csv',
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

describe('teamcenterSync', () => {
  it('flags changed datasets and proposed files', () => {
    const baseline = teamcenterSync(seedTwinArtifacts(), 'None')
    expect(
      baseline
        .flatMap(group => group.files)
        .every(file => file.state === 'In sync'),
    ).toBe(true)
    const swapped = swapTwinAvionics(seedTwinArtifacts())
    const pending = teamcenterSync(swapped, 'Pending')
    expect(pending.map(group => group.id)).toEqual([
      'MW-AVN-2700/A',
      'MW-MPA-48-4/A',
      'MW-MPA-48-5/B',
    ])
    expect(pending[0]?.files[0]).toMatchObject({
      teamcenter: 'MW-AVN-0900_C.prt',
      stream: 'MW-AVN-2700_A.prt',
      state: 'Check-in pending',
    })
    expect(
      pending[2]?.files.every(file => file.state === 'Awaiting EE approval'),
    ).toBe(true)
  })
})
