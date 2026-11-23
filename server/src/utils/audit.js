// Writes one row to audit_logs (who changed what, and the before/after values).
// Pass the transaction client when the change itself runs inside a transaction,
// so the audit row is saved (or rolled back) together with the change.
export async function audit(db, { user_id, action, target_entity, target_id, old_value = null, new_value = null }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, target_entity, target_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, action, target_entity, target_id, old_value && JSON.stringify(old_value), new_value && JSON.stringify(new_value)],
  )
}
