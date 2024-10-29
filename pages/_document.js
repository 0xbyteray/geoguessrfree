import { Html, Head, Main, NextScript } from "next/document";
import React, { useEffect } from "react";

export const runtime = 'edge';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="mainBody">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
