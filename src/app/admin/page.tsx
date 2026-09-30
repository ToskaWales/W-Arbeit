import type { Metadata } from "next";
import AdminClient from "./admin-client";

// Nicht verlinkt und für Suchmaschinen gesperrt.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
