import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bonfire",
  description: "A comunidade escolar em um só lugar.",
  icons: { icon: { url: "/bonfire.gif", type: "image/gif" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
