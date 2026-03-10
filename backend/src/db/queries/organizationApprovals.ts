import { query } from "../client";

export async function createApprovalRequest(userId: string, orgName: string, orgType: string, justification: string) {
  const result = await query(
    `INSERT INTO organization_approvals (user_id, organization_name, organization_type, justification) VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, orgName, orgType, justification]
  );
  return result.rows[0];
}

export async function getApprovalsByStatus(status: string) {
  const result = await query(
    `SELECT oa.*, u.email FROM organization_approvals oa JOIN users u ON u.id = oa.user_id WHERE oa.status = $1 ORDER BY oa.created_at DESC`,
    [status]
  );
  return result.rows;
}

export async function getApprovalByUserId(userId: string) {
  const result = await query(
    `SELECT * FROM organization_approvals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function reviewApproval(approvalId: string, status: "approved" | "rejected", adminId: string, notes?: string) {
  const result = await query(
    `UPDATE organization_approvals SET status = $2, reviewed_by = $3, admin_notes = $4, reviewed_at = now() WHERE id = $1 RETURNING *`,
    [approvalId, status, adminId, notes || null]
  );
  if (status === "approved" && result.rows[0]) {
    await query(
      `UPDATE users SET institution_verified = true, institution_name = $2, verified_at = now() WHERE id = $1`,
      [result.rows[0].user_id, result.rows[0].organization_name]
    );
  }
  return result.rows[0];
}
