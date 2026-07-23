"use client";

import { signIn } from "next-auth/react";

export default function LoginStage({ onDemoContinue }) {
  return (
    <div className="stage">
      <div id="uiv-login-form">
        <div id="uiv-form-body">
          <div id="uiv-welcome-lines">
            <div id="uiv-welcome-line-1">BuzBeats</div>
            <div id="uiv-welcome-line-2">Sign in, sign up, or try a 60s demo</div>
          </div>

          <div id="uiv-submit-button-cvr">
            <button
              id="uiv-submit-button"
              type="button"
              onClick={() => signIn("google")}
            >
              <GoogleG />
              Log in with Google
            </button>
            <button
              className="uiv-secondary-button"
              type="button"
              onClick={() => signIn("google")}
            >
              Create free account
            </button>
            <button
              className="uiv-demo-button"
              type="button"
              onClick={() => onDemoContinue?.()}
            >
              Try 60s demo
            </button>
          </div>

          <div id="uiv-bar" />
        </div>
      </div>

      <style jsx>{`
        #uiv-login-form {
          position: relative;
          display: grid;
          place-items: center;
          width: 300px;
          height: 410px;
          padding: 25px;
          background-color: #161616;
          box-shadow: 0px 15px 60px #00ff7f;
          outline: 1px solid #2b9962;
          border-radius: 10px;
        }

        #uiv-form-body {
          position: absolute;
          top: 50%;
          right: 25px;
          left: 25px;
          width: 230px;
          margin: -145px auto 0 auto;
        }

        #uiv-welcome-lines {
          text-align: center;
          line-height: 1.3;
        }

        #uiv-welcome-line-1 {
          color: #00ff7f;
          font-weight: 600;
          font-size: 34px;
          font-family: var(--font-display);
        }

        #uiv-welcome-line-2 {
          color: #ffffff;
          font-size: 14px;
          margin-top: 10px;
        }

        #uiv-submit-button-cvr {
          margin-top: 34px;
        }

        #uiv-submit-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          color: #00ff7f;
          background-color: transparent;
          font-weight: 600;
          font-size: 14px;
          margin: 0;
          padding: 14px 13px 12px 13px;
          border: 0;
          outline: 1px solid #00ff7f;
          border-radius: 8px;
          line-height: 1;
          cursor: pointer;
          transition: all ease-in-out 0.3s;
        }

        #uiv-submit-button:hover {
          background-color: #00ff7f;
          color: #161616;
        }

        .uiv-secondary-button,
        .uiv-demo-button {
          width: 100%;
          margin-top: 12px;
          padding: 13px;
          border-radius: 8px;
          font-weight: 700;
          border: 1px solid #3d3d3d;
          color: #fff;
          background: #222;
          transition: all 0.2s ease;
        }

        .uiv-demo-button {
          color: #161616;
          background: #00ff7f;
          border-color: #00ff7f;
        }

        .uiv-secondary-button:hover,
        .uiv-demo-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(0, 255, 127, 0.2);
        }

        #uiv-forgot-pass {
          text-align: center;
          margin-top: 16px;
        }

        #uiv-forgot-pass a {
          color: #868686;
          font-size: 12px;
          text-decoration: none;
        }

        #uiv-forgot-pass a:hover {
          color: #00ff7f;
        }

        #uiv-bar {
          position: absolute;
          left: 50%;
          bottom: -50px;
          width: 28px;
          height: 8px;
          margin-left: -33px;
          background-color: #00ff7f;
          border-radius: 10px;
        }

        #uiv-bar::before,
        #uiv-bar::after {
          content: "";
          position: absolute;
          width: 8px;
          height: 8px;
          background-color: #ececec;
          border-radius: 50%;
        }

        #uiv-bar::before {
          right: -20px;
        }

        #uiv-bar::after {
          right: -38px;
        }
      `}</style>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.5 2.4 30.2 0 24 0 14.9 0 7.1 5.4 3.4 13.2l7.7 6c1.8-5.4 6.9-9.7 12.9-9.7z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.2-3.9 6.7-9.7 6.7-17.4z"/>
      <path fill="#FBBC05" d="M11.1 19.2A14.5 14.5 0 0 0 10.3 24c0 1.7.3 3.3.8 4.8l-7.7 6A24 24 0 0 1 0 24c0-3.9.9-7.5 2.6-10.8z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.6 2.2-8 2.2-6 0-11.1-4-12.9-9.6l-7.7 6C7.1 42.6 14.9 48 24 48z"/>
    </svg>
  );
}
