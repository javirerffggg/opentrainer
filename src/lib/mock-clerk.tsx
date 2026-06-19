import React from "react";

// Mock User object
const mockUser = {
  id: "mock-clerk-user",
  firstName: "Usuario",
  lastName: "Local",
  fullName: "Usuario Local",
  imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
  primaryEmailAddress: {
    emailAddress: "local@opentrainer.app",
  },
  publicMetadata: {
    tier: "pro",
  },
  delete: async () => {},
};

// ClerkProvider Mock
export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// hooks
export function useAuth() {
  return {
    userId: "mock-clerk-user",
    isSignedIn: true,
    isLoaded: true,
    signOut: () => {
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/";
      }
    },
  };
}

export function useUser() {
  return {
    user: mockUser,
    isSignedIn: true,
    isLoaded: true,
  };
}

export function useClerk() {
  return {
    signOut: () => {
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/";
      }
    },
    user: mockUser,
  };
}

// components
export function SignedIn({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  // Since we are running local-only without Clerk, we are always signed in.
  // This means SignedOut will not render its children.
  return null;
}

export function SignInButton({ children, mode }: { children: React.ReactElement; mode?: string }) {
  // Redirect to dashboard on click
  return React.cloneElement(children as React.ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      window.location.href = "/dashboard";
    },
  });
}

export function SignUpButton({ children, mode }: { children: React.ReactElement; mode?: string }) {
  // Redirect to dashboard on click
  return React.cloneElement(children as React.ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      window.location.href = "/dashboard";
    },
  });
}

export function UserButton({ afterSignOutUrl, ...rest }: { afterSignOutUrl?: string; [key: string]: any }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    window.location.href = afterSignOutUrl || "/";
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 overflow-hidden rounded-full border border-border focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <img src={mockUser.imageUrl} alt="Avatar" className="h-full w-full object-cover" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover p-1 shadow-md text-popover-foreground z-50">
          <div className="px-2 py-1.5 text-xs font-semibold">Mi Cuenta</div>
          <div className="px-2 py-1 text-sm text-muted-foreground truncate">{mockUser.fullName}</div>
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">{mockUser.primaryEmailAddress.emailAddress}</div>
          <div className="my-1 border-t border-border" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-2 py-1.5 text-sm text-destructive hover:bg-muted rounded-sm transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function SubscriptionDetailsButton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="text-xs text-muted-foreground font-medium px-2 py-1 rounded bg-muted inline-block">
      Pro Alpha (Gratis de por vida)
    </div>
  );
}
