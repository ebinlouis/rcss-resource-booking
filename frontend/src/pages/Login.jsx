import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/Login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from;
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await login({ email, password });

            if (!result.success) {
                setError(result.error || 'Invalid credentials. Please try again.');
                return;
            }

            const userData = result.user;
            const capabilities = userData?.capabilities || {};

            if (from) {
    navigate(from, { replace: true });
    return;
}

if (
    userData?.is_superuser ||
    capabilities.can_manage_system ||
    capabilities.can_access_admin_portal
) {
    navigate('/admin', { replace: true });
} else if (capabilities.can_manage_mess) {
    navigate('/admin/mess', { replace: true });
} else {
    navigate('/dashboard', { replace: true });
}

        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

return (
    <div className="login-page">
        {/* LEFT PANEL */}
        <div className="brand-panel">
            <div className="brand-wave"></div>

            <div className="brand-content">
                <div className="brand-top">
                    <div className="brand-logo">
                        <img src="/logo2.png" alt="RCSS Logo" />
                    </div>

                    <div>
                        <div className="brand-name">RCSS Resource Booking</div>
                        <div className="brand-sub">
                            Rajagiri College of Social Sciences
                        </div>
                    </div>
                </div>
            </div>

            <div className="brand-center">
                <div className="brand-content">
                    <h1 className="brand-heading">
                        Reserve.
                        <br />
                        Manage.
                        <br />
                        <span className="brand-highlight">Schedule.</span>
                    </h1>

                    <p className="brand-description">
                        Book halls, request transport, manage media resources,
                        and coordinate institutional facilities through one
                        seamless platform.
                    </p>
                </div>
            </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="form-panel">
            <div className="login-card">
                <h2 className="login-title">Welcome back</h2>

                <p className="login-subtitle">
                    Sign in to your RCSS account to continue.
                </p>

                {error && (
                    <div className="error-box" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <label className="field-label">
                        Institutional Email
                    </label>

                    <div className="input-wrap">
                        <span className="input-icon material-symbols-outlined">
                            mail
                        </span>

                        <input
                            className="input-field"
                            type="email"
                            placeholder="name@rcss.ac.in"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <label className="field-label">Password</label>

                    <div className="input-wrap">
                        <span className="input-icon material-symbols-outlined">
                            lock
                        </span>

                        <input
                            className="input-field password-input"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label="Toggle password visibility"
                        >
                            <span className="material-symbols-outlined">
                                {showPassword
                                    ? 'visibility_off'
                                    : 'visibility'}
                            </span>
                        </button>
                    </div>

                    <div className="forgot-link">
                        <a href="#">Forgot password?</a>
                    </div>

                    <button
                        type="submit"
                        className="signin-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="spinner"></div>
                                Signing in...
                            </>
                        ) : (
                            <>
                                Sign In
                                <span className="material-symbols-outlined">
                                    arrow_forward
                                </span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        className="google-btn"
                        aria-label="Continue with Google"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 48 48"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.7 1.22 9.2 3.61l6.85-6.85C35.9 2.43 30.42 0 24 0 14.64 0 6.56 5.38 2.56 13.22l7.98 6.19C12.44 13.55 17.74 9.5 24 9.5z"
                            />
                            <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.14-3.09-.4-4.55H24v9.02h12.94c-.56 3-2.25 5.55-4.8 7.26l7.73 6c4.51-4.16 7.11-10.3 7.11-17.73z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M10.54 28.59A14.48 14.48 0 019.5 24c0-1.6.38-3.11 1.04-4.59l-7.98-6.19A23.93 23.93 0 000 24c0 3.87.93 7.53 2.56 10.78l7.98-6.19z"
                            />
                            <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.92-2.13 15.89-5.8l-7.73-6c-2.15 1.44-4.9 2.3-8.16 2.3-6.26 0-11.56-4.05-13.46-9.91l-7.98 6.19C6.56 42.62 14.64 48 24 48z"
                            />
                        </svg>

                        Continue with Google
                    </button>
                </form>

                <div className="security-note">
                    Protected institutional access. Your credentials remain secure.
                </div>
            </div>
        </div>
    </div>
);
}
