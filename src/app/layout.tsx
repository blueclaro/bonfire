import type { Metadata } from "next";
import "./globals.css";
import AccountApprovalGate from "@/components/AccountApprovalGate";

export const metadata: Metadata = {
  title: "Bonfire",
  description: "A comunidade escolar em um só lugar.",
  icons: { icon: { url: "/bonfire.gif", type: "image/gif" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AccountApprovalGate>{children}</AccountApprovalGate></body></html>;
}
