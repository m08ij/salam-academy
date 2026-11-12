import { Suspense } from "react";
import TokenPassword from "@/components/TokenPassword";
export default function Reset() { return <Suspense><TokenPassword endpoint="/auth/reset" titleKey="resetTitle" /></Suspense>; }
