"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-[#0e1511]" aria-busy="true" />,
});

export default function AppLoader() {
  return <App />;
}
