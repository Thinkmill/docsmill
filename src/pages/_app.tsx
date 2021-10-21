import { Global } from "@emotion/react";
import { AppProps } from "next/app";
import { globalStyles } from "../lib/theme.css";

let svg = (
  <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
    <symbol id="minus-icon" viewBox="0 0 20 20">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </symbol>
  </svg>
);

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {svg}
      <Global styles={globalStyles} />
      <Component {...pageProps} />
    </>
  );
}
export default MyApp;
