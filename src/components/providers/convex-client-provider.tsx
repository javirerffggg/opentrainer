"use client";

import { ReactNode } from "react";
import { ClerkProvider, SignedIn } from "@clerk/nextjs";
import { FeedbackButton } from "@/components/feedback/feedback-button";

interface ConvexClientProviderProps {
	children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
	return (
		<ClerkProvider>
			{children}
			<SignedIn>
				<FeedbackButton />
			</SignedIn>
		</ClerkProvider>
	);
}
