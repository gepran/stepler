import SteplerLogo from "./SteplerLogo";
import NeuronCanvas from "./NeuronCanvas";
import PropTypes from "prop-types";

export default function LoginPage({ onLogin }) {
  return (
    <div className="animate-fade-in flex h-screen w-full flex-col items-center justify-center bg-neutral-950 text-white">
      {/* Neuron background animation */}
      <NeuronCanvas />
      {/* Drag region for Electron window */}
      <div
        className="fixed top-0 left-0 z-50 h-8 w-full"
        style={{ WebkitAppRegion: "drag" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-8">
        {/* Logo */}
        <SteplerLogo size={64} />

        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome to Stepler
          </h1>
          <p className="text-base text-neutral-400">
            The fastest way to add tasks
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex w-72 flex-col gap-3">
          {/* Continue with Google */}
          <button
            onClick={onLogin}
            className="btn-tactile flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Continue with Apple */}
          <button
            onClick={onLogin}
            className="btn-tactile flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-neutral-700 bg-transparent px-6 py-3.5 text-[15px] font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:bg-neutral-900"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.53 8.8 9.28c1.27.07 2.15.72 2.88.76.99-.2 1.94-.78 3-.84 1.52-.08 2.66.54 3.37 1.62-3.19 1.89-2.43 6.1.5 7.28-.6 1.49-1.38 2.96-2.5 4.18zM12.03 9.2c-.14-2.57 1.94-4.74 4.42-4.95.34 2.89-2.65 5.08-4.42 4.95z" />
            </svg>
            Continue with Apple
          </button>
        </div>
      </div>
    </div>
  );
}

LoginPage.propTypes = {
  onLogin: PropTypes.func.isRequired,
};
