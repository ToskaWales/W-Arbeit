import { AccessProvider } from "@/components/access-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AccessProvider>{children}</AccessProvider>;
}
