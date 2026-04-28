"use client";

export function LogoutLink() {
  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };
  return (
    <a href="/api/logout" onClick={onClick} className="hover:text-foreground">
      Sign out
    </a>
  );
}
