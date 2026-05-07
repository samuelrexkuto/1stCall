"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import type { AppSessionUser, AppUserRole } from "@/lib/auth/types";

type Mode = "login" | "signup";

export function JobProviderLoginForm({
  role,
  title,
  description,
  submitLabel,
  successRedirect,
  allowRoleSwitch = false,
}: {
  role: AppUserRole;
  title: string;
  description: string;
  submitLabel: string;
  successRedirect: string;
  allowRoleSwitch?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthSession();
  const [loginRole, setLoginRole] = useState<AppUserRole>(role);
  const isProjectManagement = loginRole === "job_provider";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  function getSafeNextPath(input: string | null) {
    if (!input || !input.startsWith("/") || input.startsWith("//")) {
      return successRedirect;
    }
    return input;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const isSignup = isProjectManagement && mode === "signup";
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: loginRole,
          email,
          name,
          companyName,
          password,
          phone,
          town,
          postcode,
          accessCode: loginRole === "admin" ? accessCode : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? `${isSignup ? "Account creation" : "Login"} failed.`);
      }

      setUser(payload.user as AppSessionUser);
      const nextPath = getSafeNextPath(searchParams.get("next"));
      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErrorMessage("");
    setInfoMessage("");
  }

  function handleUnavailableGoogleLogin() {
    setErrorMessage("");
    setInfoMessage("Google login is not available yet.");
  }

  function handleForgotPassword() {
    setErrorMessage("");
    setInfoMessage("Password reset is not available yet.");
  }

  if (allowRoleSwitch || isProjectManagement || role === "admin") {
    const isSignup = mode === "signup" && loginRole === "job_provider";

    return (
      <section className="provider-auth-page">
        <div className="provider-auth-card">
          <div className="provider-auth-header">
            <h1>{isSignup ? "Create Account" : "Sign in"}</h1>
            <p>
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="provider-auth-link"
                    onClick={() => switchMode("login")}
                  >
                    Sign in here.
                  </button>
                </>
              ) : (
                <>
                  Access your workspace.
                </>
              )}
            </p>
          </div>

          {allowRoleSwitch ? (
            <div className="login-mode-switch" role="tablist" aria-label="Login type">
              <button
                type="button"
                className={loginRole === "job_provider" ? "active" : ""}
                onClick={() => {
                  setLoginRole("job_provider");
                  switchMode("login");
                }}
              >
                Client
              </button>
              <button
                type="button"
                className={loginRole === "admin" ? "active" : ""}
                onClick={() => {
                  setLoginRole("admin");
                  switchMode("login");
                }}
              >
                Admin
              </button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="provider-auth-form">
            {isSignup ? (
              <>
                <div className="provider-auth-field">
                  <input
                    id="provider-name"
                    className="provider-auth-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder=" "
                    required
                  />
                  <label htmlFor="provider-name">Name</label>
                </div>
                <div className="provider-auth-field">
                  <input
                    id="provider-company"
                    className="provider-auth-input"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder=" "
                    required
                  />
                  <label htmlFor="provider-company">Company or account name</label>
                </div>
              </>
            ) : null}

            {loginRole === "admin" ? (
              <div className="provider-auth-field">
                <input
                  id="provider-access-code"
                  className="provider-auth-input"
                  type="password"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder=" "
                />
                <label htmlFor="provider-access-code">Access code</label>
              </div>
            ) : null}

            <div className="provider-auth-field">
              <input
                id="provider-email"
                className="provider-auth-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder=" "
                required
              />
              <label htmlFor="provider-email">Email</label>
            </div>

            <div className="provider-auth-field">
              <input
                id="provider-password"
                className="provider-auth-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder=" "
                minLength={isSignup ? 8 : undefined}
                required
              />
              <label htmlFor="provider-password">Password</label>
            </div>

            {isSignup ? (
              <>
                <div className="provider-auth-field">
                  <input
                    id="provider-phone"
                    className="provider-auth-input"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder=" "
                  />
                  <label htmlFor="provider-phone">Phone</label>
                </div>
                <div className="provider-auth-field">
                  <input
                    id="provider-town"
                    className="provider-auth-input"
                    value={town}
                    onChange={(event) => setTown(event.target.value)}
                    placeholder=" "
                  />
                  <label htmlFor="provider-town">Town</label>
                </div>
                <div className="provider-auth-field">
                  <input
                    id="provider-postcode"
                    className="provider-auth-input"
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                    placeholder=" "
                  />
                  <label htmlFor="provider-postcode">Postcode</label>
                </div>
              </>
            ) : null}

            {errorMessage ? <p className="provider-auth-error">{errorMessage}</p> : null}
            {infoMessage ? <p className="provider-auth-info">{infoMessage}</p> : null}

            <button type="submit" disabled={submitting} className="provider-auth-primary-button">
              {submitting
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? "Create Account"
                  : loginRole === "admin"
                    ? "Login as Admin"
                    : "Login as Client"}
            </button>

            <button
              type="button"
              className="provider-auth-social-button"
              onClick={handleUnavailableGoogleLogin}
            >
              <span className="provider-auth-google-mark" aria-hidden="true">G</span>
              <span>Login with Google</span>
            </button>
          </form>

          {loginRole === "job_provider" && !isSignup ? (
            <p className="provider-auth-create-row">
              <span>Don&apos;t have an account?</span>
              <button type="button" className="provider-auth-link" onClick={() => switchMode("signup")}>
                Create a client account
              </button>
            </p>
          ) : null}

          <p className="provider-auth-forgot-row">
            <span>Forget password</span>
            <button type="button" className="provider-auth-link" onClick={handleForgotPassword}>
              Click here
            </button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        maxWidth: 560,
        margin: "2rem auto 0",
        padding: "1.25rem",
        borderRadius: 18,
        border: "1px solid #dbe1ea",
        background: "#ffffff",
        display: "grid",
        gap: "1rem",
      }}
    >
      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#475569" }}>{description}</p>
      </div>

      {isProjectManagement ? (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{
              background: mode === "login" ? "#0f172a" : "#ffffff",
              color: mode === "login" ? "#ffffff" : "#0f172a",
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            style={{
              background: mode === "signup" ? "#0f172a" : "#ffffff",
              color: mode === "signup" ? "#ffffff" : "#0f172a",
            }}
          >
            Create account
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.9rem" }}>
        {isProjectManagement && mode === "signup" ? (
          <>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Klaudia Smith"
                required
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              Company or account name
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Atlas Consulting / Project Team"
                required
              />
            </label>
          </>
        ) : null}

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder=""
          />
        </label>

        {isProjectManagement && mode === "signup" ? (
          <>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              Phone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              Town
              <input
                value={town}
                onChange={(event) => setTown(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              Postcode
              <input
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </>
        ) : null}

        {loginRole === "admin" ? (
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Access code
            <input
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Uses ADMIN_ACCESS_CODE if configured"
            />
          </label>
        ) : null}

        {errorMessage ? <p style={{ margin: 0, color: "#b91c1c" }}>{errorMessage}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting
            ? mode === "signup"
              ? "Creating account..."
              : "Signing in..."
            : isProjectManagement
              ? mode === "signup"
                ? "Create project management account"
                : submitLabel
              : submitLabel}
        </button>
      </form>
    </section>
  );
}
