import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Scheduler",
  description: "Plataforma de agendamento de publicações para redes sociais",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
