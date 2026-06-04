import type { UserRole } from "@/lib/auth";

export const getDashboardPath = (role?: UserRole | null) => {
  if (role === "admin") return "/admin";
  if (role === "doctor") return "/doctor-dashboard";
  return "/dashboard";
};
