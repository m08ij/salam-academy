import { Suspense } from "react";
import TokenPassword from "@/components/TokenPassword";
export default function AcceptInvite() { return <Suspense><TokenPassword endpoint="/auth/accept-invite" titleKey="inviteTitle" doneKey="inviteDone" /></Suspense>; }
