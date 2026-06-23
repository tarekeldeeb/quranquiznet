// Expo Router web root HTML. The quran-madina-html library itself is loaded at
// runtime by the @tarekeldeeb/quran-madina-react wrapper (see QuranText.web.tsx);
// here we only add CSS to blend its output into the quiz card.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        {/* Blend the Madina renderer into the quiz card: drop the library's beige
            tint, rounded corners, the inset mushaf-page shadow, and any header. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            quran-madina-html {
              background: transparent !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            quran-madina-html-header { display: none !important; }
          `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
