import "./globals.css";
import Providers from "./providers";
import AppChrome from "@/components/AppChrome";

export const metadata = {
  title: "Nook Radio — mood radio for cafés & restaurants",
  description:
    "Pick a language, turn the mood dial, and play a mood-matched live radio stream for your space.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}<AppChrome /></Providers>
      </body>
    </html>
  );
}
