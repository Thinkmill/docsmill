import { Global } from "@emotion/react";
import { AppProps } from "next/app";
import { globalStyles } from "../lib/theme.css";
import "@algolia/autocomplete-theme-classic";
import { useEffect } from "react";
import Router from "next/router";

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

function openParentDetails(element: HTMLElement) {
  if (element instanceof HTMLDetailsElement) {
    element.open = true;
  }
  if (element.parentElement) {
    openParentDetails(element.parentElement);
  }
}

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const handler = () => {
      // pushState doesn't update :target, assigning window.location.hash does though
      window.location.hash = window.location.hash;
    };
    Router.events.on("routeChangeComplete", handler);
    return () => {
      Router.events.off("routeChangeComplete", handler);
    };
  }, []);
  useEffect(() => {
    let handler = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const element = document.getElementById(hash);
      if (!element) return;
      openParentDetails(element);
      element.scrollIntoView();
    };
    window.addEventListener("hashchange", handler, false);
    handler();
    return () => {
      window.removeEventListener("hashchange", handler);
    };
  }, []);

  return (
    <>
      {svg}
      <Global styles={globalStyles} />
      <Component {...pageProps} />
    </>
  );
}
export default MyApp;
