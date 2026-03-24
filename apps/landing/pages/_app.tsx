import type { AppProps } from "next/app";
import "../app/globals.css";
import { Providers } from "../app/providers";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <Component {...pageProps} />
    </Providers>
  );
}
