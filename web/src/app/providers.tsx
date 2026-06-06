"use client"

import { NotificationProvider } from "@/components/ui/Notifications"
import { usePathname } from "next/navigation"
import { SessionProvider, signOut, useSession } from "next-auth/react"
import { useEffect } from "react"

function BannedSessionWatcher() {
	const pathname = usePathname()
	const { status } = useSession()

	useEffect(() => {
		if (status !== "authenticated" || pathname === "/login") {
			return
		}

		let isSigningOut = false
		const controller = new AbortController()
		const verifySession = async () => {
			if (isSigningOut) {
				return
			}

			try {
				const response = await fetch("/api/profile", {
					cache: "no-store",
					signal: controller.signal,
				})

				if (response.status === 401 || response.status === 403) {
					isSigningOut = true
					await signOut({
						callbackUrl: "/login?error=BANNED",
						redirect: true,
					})
				}
			} catch {
				// Network failures should not log the user out.
			}
		}
		const intervalId = window.setInterval(verifySession, 15_000)

		void verifySession()
		window.addEventListener("focus", verifySession)

		return () => {
			controller.abort()
			window.clearInterval(intervalId)
			window.removeEventListener("focus", verifySession)
		}
	}, [pathname, status])

	return null
}

export default function Providers({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<SessionProvider>
			<BannedSessionWatcher />
			<NotificationProvider>{children}</NotificationProvider>
		</SessionProvider>
	)
}
