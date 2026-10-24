export function buildOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SuvidhaPay — Municipal Collection Management System API',
      version: '1.0.0',
      description:
        'Authoritative REST API (/api/v1) for SuvidhaPay Municipal ERP covering Authentication, RBAC, Wards/Zones, Categories, Unified Entity Registration, Non-Retroactive Rate Master, Due Engine, Cash & Manual UPI Collections, Atomic Allocations, Server Receipts, Daily Cash Closing, Gateway Reconciliation, Disputes, Reports, Notifications, Vahan Verification, Legacy Import, and Read-Only Audit Logs.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'SuvidhaPay v1 REST API',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Authenticate user and issue short-lived access + refresh tokens',
          security: [],
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Rotate refresh token and issue new access token',
          security: [],
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Revoke active refresh session token',
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate single-use expiring password reset token',
          security: [],
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password using single-use reset token',
          security: [],
        },
      },
      '/auth/change-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change current authenticated user password',
        },
      },
      '/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current authenticated user profile and jurisdiction scope',
        },
      },
      '/users': {
        get: { tags: ['Users & Jurisdictions'], summary: 'List municipal users' },
        post: { tags: ['Users & Jurisdictions'], summary: 'Create new staff or agent user' },
      },
      '/users/{id}': {
        get: { tags: ['Users & Jurisdictions'], summary: 'Get user details and session history' },
        patch: { tags: ['Users & Jurisdictions'], summary: 'Update user role or ward assignment' },
      },
      '/users/{id}/status': {
        patch: {
          tags: ['Users & Jurisdictions'],
          summary: 'Activate, disable, or lock user account (safe deactivation)',
        },
      },
      '/wards': {
        get: { tags: ['Users & Jurisdictions'], summary: 'List municipal wards' },
        post: { tags: ['Users & Jurisdictions'], summary: 'Create ward' },
      },
      '/zones': {
        get: { tags: ['Users & Jurisdictions'], summary: 'List municipal zones' },
        post: { tags: ['Users & Jurisdictions'], summary: 'Create zone' },
      },
      '/categories': {
        get: { tags: ['Categories & Entities'], summary: 'List configurable entity categories' },
        post: { tags: ['Categories & Entities'], summary: 'Create entity category' },
      },
      '/entities': {
        get: { tags: ['Categories & Entities'], summary: 'List and filter municipal entities' },
        post: { tags: ['Categories & Entities'], summary: 'Register vehicle or vendor entity' },
      },
      '/entities/search': {
        get: {
          tags: ['Categories & Entities'],
          summary: 'Fast normalized search by vehicle no, vendor ID, mobile, receipt, or payment ref',
        },
      },
      '/entities/{id}': {
        get: { tags: ['Categories & Entities'], summary: 'Get entity profile' },
        patch: { tags: ['Categories & Entities'], summary: 'Update entity details' },
      },
      '/entities/{id}/dues': {
        get: { tags: ['Categories & Entities'], summary: 'Get entity due ledger history' },
      },
      '/entities/{id}/outstanding': {
        get: {
          tags: ['Categories & Entities'],
          summary: 'Get server-calculated 6-column outstanding balance breakdown',
        },
      },
      '/entities/{id}/payments': {
        get: { tags: ['Categories & Entities'], summary: 'Get entity payment history' },
      },
      '/entities/{id}/submit': {
        post: { tags: ['Registrations'], summary: 'Submit draft registration for Officer review' },
      },
      '/entities/{id}/approve': {
        post: { tags: ['Registrations'], summary: 'Officer approve registration within ward jurisdiction' },
      },
      '/entities/{id}/reject': {
        post: { tags: ['Registrations'], summary: 'Officer reject registration with mandatory reason' },
      },
      '/rates': {
        get: { tags: ['Rate Master'], summary: 'List rate masters' },
        post: { tags: ['Rate Master'], summary: 'Publish new rate master (preserves historical dues)' },
      },
      '/rates/{id}': {
        get: { tags: ['Rate Master'], summary: 'Get rate master details' },
        patch: { tags: ['Rate Master'], summary: 'Update rate master' },
      },
      '/dues': {
        get: { tags: ['Due Engine'], summary: 'List due records' },
        post: { tags: ['Due Engine'], summary: 'Execute rate-based batch due generation' },
      },
      '/dues/{id}/adjust': {
        post: { tags: ['Due Engine'], summary: 'Record auditable adjustment on a due' },
      },
      '/dues/{id}/waive': {
        post: { tags: ['Due Engine'], summary: 'Record auditable waiver on a due' },
      },
      '/payments': {
        get: { tags: ['Payments & Allocations'], summary: 'List payments' },
      },
      '/payments/cash': {
        post: {
          tags: ['Payments & Allocations'],
          summary: 'Record authorized cash collection, allocate dues, and issue server receipt',
        },
      },
      '/payments/manual-upi': {
        post: {
          tags: ['Payments & Allocations'],
          summary: 'Record manual UPI UTR reference as PENDING (unverified) without issuing final receipt',
        },
      },
      '/payments/orders': {
        post: {
          tags: ['Payments & Allocations'],
          summary: 'Create mock online payment gateway order (Razorpay/Cashfree adapter)',
        },
      },
      '/payments/{id}': {
        get: { tags: ['Payments & Allocations'], summary: 'Get payment & allocation details' },
      },
      '/payments/{id}/status': {
        get: { tags: ['Payments & Allocations'], summary: 'Poll payment processing & settlement status' },
      },
      '/payments/{id}/verify': {
        post: {
          tags: ['Payments & Allocations'],
          summary: 'Verify pending manual UPI UTR or gateway webhook and issue official receipt',
        },
      },
      '/payments/{id}/refunds': {
        post: { tags: ['Payments & Allocations'], summary: 'Process full or partial refund' },
      },
      '/payments/{id}/reverse': {
        post: { tags: ['Payments & Allocations'], summary: 'Reverse erroneous payment and restore due balances' },
      },
      '/receipts': {
        get: { tags: ['Receipts'], summary: 'List official municipal receipts' },
      },
      '/receipts/{id}': {
        get: { tags: ['Receipts'], summary: 'Get receipt details' },
      },
      '/receipts/{id}/pdf': {
        get: { tags: ['Receipts'], summary: 'Download structured PDF receipt payload' },
      },
      '/receipts/verify/{code}': {
        get: {
          tags: ['Receipts'],
          summary: 'Public privacy-safe receipt verification endpoint (masks PII)',
          security: [],
        },
      },
      '/collections/today': {
        get: { tags: ['Field Collections & Closing'], summary: "Get today's collections list" },
      },
      '/collections/summary': {
        get: { tags: ['Field Collections & Closing'], summary: 'Get collection totals summary' },
      },
      '/collections/closing': {
        get: { tags: ['Field Collections & Closing'], summary: 'List daily cash closings' },
        post: { tags: ['Field Collections & Closing'], summary: 'Create daily cash closing record' },
      },
      '/collections/closing/{id}': {
        get: { tags: ['Field Collections & Closing'], summary: 'Get daily cash closing details' },
      },
      '/collections/closing/{id}/submit': {
        post: { tags: ['Field Collections & Closing'], summary: 'Submit physical cash count (locks agent edits)' },
      },
      '/collections/closing/{id}/verify': {
        post: { tags: ['Field Collections & Closing'], summary: 'Officer verify or return daily cash closing' },
      },
      '/reconciliation': {
        get: { tags: ['Reconciliation & Disputes'], summary: 'List gateway vs ledger reconciliation items' },
      },
      '/reconciliation/run': {
        post: { tags: ['Reconciliation & Disputes'], summary: 'Execute reconciliation matching pass' },
      },
      '/reconciliation/{id}': {
        get: { tags: ['Reconciliation & Disputes'], summary: 'Get reconciliation item details' },
      },
      '/reconciliation/{id}/resolve': {
        post: { tags: ['Reconciliation & Disputes'], summary: 'Resolve reconciliation discrepancy' },
      },
      '/disputes': {
        get: { tags: ['Reconciliation & Disputes'], summary: 'List disputes, refunds, and reversals' },
        post: { tags: ['Reconciliation & Disputes'], summary: 'Create dispute record' },
      },
      '/disputes/{id}/resolve': {
        post: { tags: ['Reconciliation & Disputes'], summary: 'Adjudicate and resolve dispute' },
      },
      '/reports/collections/daily': {
        get: { tags: ['Reports'], summary: 'Daily collections report' },
      },
      '/reports/collections/monthly': {
        get: { tags: ['Reports'], summary: 'Monthly collections report' },
      },
      '/reports/collections/agents': {
        get: { tags: ['Reports'], summary: 'Agent performance report' },
      },
      '/reports/collections/categories': {
        get: { tags: ['Reports'], summary: 'Category-wise collection report' },
      },
      '/reports/collections/wards': {
        get: { tags: ['Reports'], summary: 'Ward-wise collection report' },
      },
      '/reports/outstanding': {
        get: { tags: ['Reports'], summary: 'Outstanding dues aging report' },
      },
      '/reports/export': {
        get: { tags: ['Reports'], summary: 'Export report as CSV' },
      },
      '/notifications': {
        get: { tags: ['Notifications'], summary: 'List notification logs' },
        post: { tags: ['Notifications'], summary: 'Dispatch SMS/WhatsApp/In-App notification via mock adapter' },
      },
      '/notifications/{id}': {
        get: { tags: ['Notifications'], summary: 'Get notification delivery details' },
      },
      '/notifications/{id}/retry': {
        post: { tags: ['Notifications'], summary: 'Retry failed notification delivery' },
      },
      '/notification-templates': {
        get: { tags: ['Notifications'], summary: 'List notification templates' },
        post: { tags: ['Notifications'], summary: 'Create notification template' },
      },
      '/verifications/vehicles': {
        post: { tags: ['Government Verification'], summary: 'Request Vahan/SVANidhi verification via mock adapter' },
      },
      '/verifications/{id}': {
        get: { tags: ['Government Verification'], summary: 'Get government verification record' },
      },
      '/verifications/{id}/retry': {
        post: { tags: ['Government Verification'], summary: 'Retry government verification after 503 timeout' },
      },
      '/imports': {
        post: { tags: ['Data Import'], summary: 'Stage and validate CSV/JSON legacy import rows' },
      },
      '/imports/{id}/commit': {
        post: { tags: ['Data Import'], summary: 'Commit validated staging import rows to ledger' },
      },
      '/audit-logs': {
        get: { tags: ['Audit & Operations'], summary: 'Search read-only cryptographic audit trail' },
      },
      '/settings': {
        get: { tags: ['Audit & Operations'], summary: 'Get municipal system settings (secrets masked)' },
        patch: { tags: ['Audit & Operations'], summary: 'Update municipal system settings' },
      },
      '/health': {
        get: { tags: ['Audit & Operations'], summary: 'System health overview', security: [] },
      },
      '/health/live': {
        get: { tags: ['Audit & Operations'], summary: 'Liveness probe', security: [] },
      },
      '/health/ready': {
        get: { tags: ['Audit & Operations'], summary: 'Readiness probe (checks storage availability)', security: [] },
      },
    },
  };
}
