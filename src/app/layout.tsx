import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import PlausibleProvider from "next-plausible";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "OpenTrainer - Seguimiento de Entrenamientos con IA",
	description:
		"Seguimiento de entrenamientos minimalista y con IA. Registra levantamientos y cardio fácilmente, obtén rutinas sugeridas por IA y evaluaciones de rendimiento.",
	manifest: "/manifest.json",
	icons: {
		icon: [
			{ url: "/icon.svg", type: "image/svg+xml" },
			{ url: "/favicon.ico", type: "image/x-icon" },
		],
		shortcut: "/favicon.ico",
		apple: "/apple-touch-icon.png",
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "OpenTrainer",
	},
	openGraph: {
		title: "OpenTrainer - Seguimiento de Entrenamientos con IA",
		description: "Registra entrenamientos, obtén coaching de IA. Así de simple.",
		type: "website",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f5f3f0" },
		{ media: "(prefers-color-scheme: dark)", color: "#1c1a22" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<PlausibleProvider domain="opentrainer.app">
						<ConvexClientProvider>
							{children}
							<Toaster position="top-center" richColors />
						</ConvexClientProvider>
					</PlausibleProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
