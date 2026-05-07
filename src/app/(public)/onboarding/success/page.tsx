export default function PublicOnboardingSuccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: "2rem",
          textAlign: "center",
          background: "#ffffff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <img src="/logo.svg" alt="Recruited Dispatch" style={{ height: 64, width: "auto", margin: "0 auto 1.25rem" }} />
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "2rem" }}>
          Thank you
        </h1>
        <p style={{ margin: 0, color: "#52525b", fontSize: "1.05rem", lineHeight: 1.6 }}>
          Your details have been submitted successfully. Our team will review your application next, and contract or follow-up steps will only be issued if your submission is approved for the managed workforce pool.
        </p>
      </div>
    </div>
  );
}
