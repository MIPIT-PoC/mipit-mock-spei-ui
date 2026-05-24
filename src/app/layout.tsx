/**
 * @file layout.tsx
 * @description Root Next.js App Router layout for the SPEI mock UI; wires global metadata, fonts and the dark theme provider around all pages.
 * @author María Camila Osuna
 * @project MIPIT-PoC — Cross-border Instant Payments Middleware
 */
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/theme-provider';
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
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
