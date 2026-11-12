import View from "./View";

/** A static export (GitHub Pages preview) needs at least one pre-rendered path; real ids are rendered on demand by the server build. */
export function generateStaticParams() {
  return [{ eid: "demo", lid: "demo" }];
}

export default function Page() {
  return <View />;
}
