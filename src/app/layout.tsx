import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPEI Mock Simulator',
  description: 'Simulador de transacciones SPEI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
