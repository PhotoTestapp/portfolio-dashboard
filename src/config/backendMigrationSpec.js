export const BACKEND_MIGRATION_SPEC = {
  schemaVersion: 'backend-minimum-v1',
  targetBackend: 'Supabase',
  tables: [
    {
      name: 'portfolio_state',
      purpose: 'Store one latest portfolio JSON state per authenticated user.',
      keyFields: ['user_id'],
      requiredFields: ['revision', 'state', 'state_hash']
    },
    {
      name: 'audit_log',
      purpose: 'Append-only audit events for changes, imports, restores, mode changes, and rule changes.',
      keyFields: ['user_id', 'created_at'],
      requiredFields: ['event_type', 'payload']
    },
    {
      name: 'decision_history',
      purpose: 'Store historical decision snapshots for backtesting and rule evaluation.',
      keyFields: ['user_id', 'code', 'created_at'],
      requiredFields: ['code', 'decision', 'snapshot']
    }
  ],
  unsupportedOnStaticPages: [
    'service_role key usage',
    'broker OAuth token exchange',
    'paid market data API secret handling',
    'PDF/HTML evidence body verification at scale'
  ]
}
