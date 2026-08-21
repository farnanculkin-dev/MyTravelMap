import { useState } from 'react'
import type { MigrationSummary } from '../lib/customerZeroMigration'

export default function CustomerZeroMigrationPanel({
  atlasId,
  onMigrate,
}: {
  atlasId: string
  onMigrate: () => Promise<MigrationSummary>
}) {
  const [isMigrating, setIsMigrating] = useState(false)
  const [summary, setSummary] = useState<MigrationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMigrate() {
    setIsMigrating(true)
    setError(null)
    try {
      setSummary(await onMigrate())
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : 'Migration could not be completed.')
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <section className="migration-panel" aria-labelledby="migration-title">
      <div className="migration-heading">
        <div>
          <p className="auth-eyebrow">Administrator tool</p>
          <h2 id="migration-title">Copy this browser's V1 data to the Atlas</h2>
        </div>
        <button className="primary-btn" type="button" onClick={handleMigrate} disabled={isMigrating}>
          {isMigrating ? 'Migrating...' : 'Run one-time migration'}
        </button>
      </div>
      <p className="migration-note">This does not delete local data or change which repository the app uses.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {summary && (
        <div className="migration-summary" role="status">
          <p>Atlas found: <strong>{summary.atlasId}</strong></p>
          <p>Profiles: {summary.profilesFound} found, {summary.profilesCreated} created</p>
          <p>Travel: {summary.travelRecordsFound} found, {summary.travelRecordsCreated} rows created, {summary.profileTravelMigrated} records migrated</p>
          <p>Colours migrated: {summary.coloursMigrated}</p>
          <p>Photos: group {summary.groupPhotoMigrated ? 'migrated' : 'not migrated'}, {summary.profilePhotosMigrated} profile photos migrated</p>
          {summary.skipped.length > 0 && <p>Skipped: {summary.skipped.join('; ')}</p>}
          {summary.warnings.length > 0 && <p>Warnings: {summary.warnings.join('; ')}</p>}
          {summary.errors.length > 0 && <p className="auth-error">Errors: {summary.errors.join('; ')}</p>}
        </div>
      )}
    </section>
  )
}