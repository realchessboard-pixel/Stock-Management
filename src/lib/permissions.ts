/**
 * Role → permission map. Client-safe (used to hide buttons); the server
 * ALWAYS re-checks with assertCan(). To add a permission, add it here and
 * grant it to roles. Custom roles can later replace ROLE_PERMISSIONS with a
 * DB lookup without changing call sites.
 */
export const ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = [
  // daily operations
  "product.view",
  "stock.scan",
  "stock.receive",
  "stock.out",
  // inventory management
  "stock.adjust",
  "stock.ledger",
  "product.write",
  "product.import",
  "product.export",
  "category.write",
  "supplier.view",
  "supplier.write",
  "location.write",
  "report.view",
  "label.print",
  // administration
  "user.manage",
  "business.settings",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = ["product.view", "stock.scan", "stock.receive", "stock.out", "label.print", "supplier.view"];

const MANAGER: Permission[] = [
  ...STAFF,
  "stock.adjust",
  "stock.ledger",
  "product.write",
  "product.import",
  "product.export",
  "category.write",
  "supplier.write",
  "location.write",
  "report.view",
];

export const ROLE_PERMISSIONS: Record<RoleName, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  MANAGER: new Set(MANAGER),
  STAFF: new Set(STAFF),
};

export function roleCan(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<RoleName, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};
