import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Package,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission };

/** Mobile bottom bar: 5 slots, Scan in the middle. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/products", label: "Inventory", icon: Boxes, permission: "product.view" },
  { href: "/scan", label: "Scan", icon: ScanBarcode, permission: "stock.scan" },
  { href: "/movements", label: "Movements", icon: ArrowLeftRight, permission: "product.view" },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** Desktop sidebar. */
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package, permission: "product.view" },
  { href: "/inventory", label: "Inventory", icon: Boxes, permission: "product.view" },
  { href: "/movements", label: "Stock Movements", icon: ArrowLeftRight, permission: "product.view" },
  { href: "/low-stock", label: "Low Stock", icon: ClipboardList, permission: "product.view" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, permission: "supplier.view" },
  { href: "/categories", label: "Categories", icon: Tags, permission: "category.write" },
  { href: "/locations", label: "Locations", icon: MapPin, permission: "location.write" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "report.view" },
  { href: "/users", label: "Users", icon: Users, permission: "user.manage" },
  { href: "/audit", label: "Audit Log", icon: ShieldCheck, permission: "audit.view" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "business.settings" },
];

/** "More" page on mobile: everything not in the bottom bar. */
export const MORE_NAV: NavItem[] = [
  ...SIDEBAR_NAV.filter((i) => !["/dashboard", "/products", "/movements"].includes(i.href)),
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
