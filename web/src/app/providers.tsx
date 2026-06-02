"use client"

import { NotificationProvider } from "@/components/ui/Notifications"
import { SessionProvider } from "next-auth/react"

export default function Providers({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<SessionProvider>
			<NotificationProvider>{children}</NotificationProvider>
		</SessionProvider>
	)
}
