import { useEffect, useState } from "react";
import {
  Check,
  Envelope,
  Info,
  LockKey,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "../components/ui/button";
import { GoogleBrandMark } from "./GoogleBrandMark";
import { hasSupabaseConfig } from "../lib/supabase";

export function Welcome({
  error,
  busy,
  onSignIn,
}: {
  error: string;
  busy: boolean;
  onSignIn: () => void;
}) {
  const [gmailError, setGmailError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("gmail") === "error")
      setGmailError(query.get("message") || "Gmail could not connect.");
    if (query.has("gmail")) history.replaceState({}, "", location.pathname);
  }, []);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="brand-mark">
            <Envelope weight="duotone" />
          </span>
          <span>Email Sender</span>
        </div>
        <div className="auth-story-copy">
          <h1>
            Make every email
            <br />
            <em>personal.</em>
          </h1>
          <p>
            Prepare a message for each contact. Send each email from your own
            Gmail account.
          </p>
        </div>
        <div className="auth-letter" aria-hidden="true">
          <div className="letter-top">
            <span className="letter-badge">
              <Sparkle size={13} weight="fill" /> PERSONALIZED
            </span>
            <span className="letter-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="letter-to">
            <span className="letter-avatar">C</span>
            <span>
              <small>TO</small>
              <b>POC Name</b>
              <em>Company Name</em>
            </span>
            <span className="letter-check">
              <Check size={14} weight="bold" />
            </span>
          </div>
          <div className="letter-lines">
            <i />
            <i />
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className="letter-footer">
            <span>Company Name × ForkThis</span>
            <span>Ready to review</span>
          </div>
        </div>
        <div className="auth-meta">
          <span>Private by design</span>
          <span>Built for your team</span>
          <span>Works with free plans</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <h2>Sign in</h2>
          <p>
            Use your Google account to open your workspace. Connect Gmail
            separately when you are ready to send email.
          </p>
          {!hasSupabaseConfig && (
            <div className="setup-note">
              <Info size={18} />
              <div>
                <b>Finish setup</b>
                <span>
                  Add your Supabase keys to <code>.env.local</code>, then
                  restart the app. See the README for steps.
                </span>
              </div>
            </div>
          )}
          {(error || gmailError) && (
            <div className="inline-alert error">
              <WarningCircle size={17} />
              {gmailError || error}
            </div>
          )}
          <Button
            className="google-button"
            size="lg"
            disabled={!hasSupabaseConfig || busy}
            onClick={onSignIn}
          >
            <GoogleBrandMark size={18} /> Sign in with Google
          </Button>
          <div className="auth-separator">
            <span /> BEFORE YOU SEND <span />
          </div>
          <div className="auth-step">
            <span>1</span>
            <div>
              <b>Sign in to Email Sender</b>
              <small>Your profile, templates, and campaign history.</small>
            </div>
          </div>
          <div className="auth-step">
            <span>2</span>
            <div>
              <b>Connect Gmail to send</b>
              <small>The app can send email. It cannot read your inbox.</small>
            </div>
          </div>
          <div className="auth-privacy">
            <LockKey size={15} /> Your contacts and campaign data stay private
            to your account.
          </div>
          <div className="auth-links">
            <a href="/privacy.html">Privacy</a>
            <span>·</span>
            <a href="/terms.html">Terms</a>
          </div>
        </div>
      </section>
    </main>
  );
}
