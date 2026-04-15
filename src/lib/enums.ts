/**
 * App-level enums. SQLite + Prisma doesn't support native DB enums, so the
 * corresponding columns are stored as strings. These const objects give us
 * the same ergonomics as Prisma-generated enums (UserRole.ADMIN, etc.) with
 * compile-time safety via the exported types.
 */

export const UserRole = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  DEPARTMENT_HEAD: "DEPARTMENT_HEAD",
  KARIGAR: "KARIGAR",
  QC: "QC",
  VIEWER: "VIEWER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CustomerType = {
  RETAIL: "RETAIL",
  WHOLESALE: "WHOLESALE",
  END_CUSTOMER: "END_CUSTOMER",
  INTERNAL: "INTERNAL",
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const Priority = {
  NORMAL: "NORMAL",
  RUSH: "RUSH",
  VIP: "VIP",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const OrderStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  READY_FOR_DISPATCH: "READY_FOR_DISPATCH",
  DISPATCHED: "DISPATCHED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const MetalType = {
  GOLD_22K: "GOLD_22K",
  GOLD_18K: "GOLD_18K",
  GOLD_14K: "GOLD_14K",
  SILVER: "SILVER",
  PLATINUM: "PLATINUM",
} as const;
export type MetalType = (typeof MetalType)[keyof typeof MetalType];

export const MetalColor = {
  YELLOW: "YELLOW",
  WHITE: "WHITE",
  ROSE: "ROSE",
  NA: "NA",
} as const;
export type MetalColor = (typeof MetalColor)[keyof typeof MetalColor];

export const StageStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  REWORK: "REWORK",
  SKIPPED: "SKIPPED",
} as const;
export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  STAGE_IN: "STAGE_IN",
  STAGE_OUT: "STAGE_OUT",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
