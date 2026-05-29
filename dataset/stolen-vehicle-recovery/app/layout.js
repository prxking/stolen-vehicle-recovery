import './globals.css';
import { Providers } from './Providers';

export const metadata = {
  title: 'Stolen Vehicle Recovery',
  description: 'Futuristic AI-powered stolen vehicle recovery system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
