import { Global } from "@emotion/react";
import {
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { globalStyles } from "../lib/theme.css";

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: () => <main>Not found</main>,
});

function openParentDetails(element: HTMLElement) {
  if (element instanceof HTMLDetailsElement) element.open = true;
  if (element.parentElement) openParentDetails(element.parentElement);
}

function AppShell() {
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    const revealHashTarget = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const element = document.getElementById(hash);
      if (!element) return;
      openParentDetails(element);
      element.scrollIntoView();
    };
    window.addEventListener("hashchange", revealHashTarget);
    revealHashTarget();
    return () => window.removeEventListener("hashchange", revealHashTarget);
  }, [href]);

  return (
    <>
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
      <Global styles={globalStyles} />
      <Outlet />
    </>
  );
}
