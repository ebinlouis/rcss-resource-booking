import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await login({ email, password });

            if (result.success) {
                const userData = result.user;

                if (
                    userData?.is_superuser ||
                    userData?.capabilities?.can_manage_system
                ) {
                    navigate('/admin');
                } else if (userData?.capabilities?.can_manage_mess) {
                    navigate('/admin/mess');
                } else if (userData?.capabilities?.can_access_admin_portal) {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(result.error || 'Invalid credentials. Please try again.');
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <style>{`
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: Geist, Inter, system-ui, sans-serif;
        background: #f6f8f7;
    }

    @keyframes fadeUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes floatSlow {
        0%, 100% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-10px);
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .login-page {
        min-height: 100vh;
        display: flex;
        background: #f6f8f7;
        overflow: hidden;
    }

    /* LEFT SIDE */

.brand-panel {
    width: 42%;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    background:
        radial-gradient(circle at top left, rgba(20, 120, 72, 0.35), transparent 28%),
        linear-gradient(145deg, #032b18 0%, #0c653a 38%, #0b5d35 100%);
    padding: 40px 42px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

    .brand-panel::before {
        content: '';
        position: absolute;
        top: -120px;
        right: -120px;
        width: 420px;
        height: 420px;
        border-radius: 38%;
        background: rgba(255,255,255,0.05);
    }

    .brand-panel::after {
        content: '';
        position: absolute;
        bottom: -140px;
        left: -100px;
        width: 420px;
        height: 420px;
        border-radius: 42%;
        background: rgba(255,255,255,0.04);
    }

    .brand-wave {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 180px;
        background:
            radial-gradient(ellipse at bottom left, rgba(130,216,163,0.2), transparent 60%);
    }

    .brand-content {
        position: relative;
        z-index: 2;
        animation: fadeUp .7s ease;
    }

.brand-top {
    display: flex;
    align-items: center;
    gap: 16px;
}

.brand-logo {
    width: 58px;
    height: 58px;
    border-radius: 12px;
    background: rgba(255,255,255,0.98);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.14);
    flex-shrink: 0;
    overflow: hidden;
}

.brand-logo img {
    width: 48px;
    height: 48px;
    object-fit: contain;
    display: block;
}

.brand-name {
    color: white;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.15;
}

.brand-sub {
    color: rgba(255,255,255,0.72);
    font-size: 12px;
    margin-top: 4px;
}

    .brand-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.08);
        margin-bottom: 28px;
    }

    .brand-pill-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9ef5be;
    }

    .brand-pill-text {
        color: white;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: .08em;
    }

.brand-heading {
    font-size: 46px;
    font-weight: 800;
    line-height: 1.05;
    color: white;
    letter-spacing: -0.04em;
    max-width: 420px;
}

    .brand-highlight {
        color: #9ef5be;
    }

.brand-description {
    margin-top: 16px;
    color: rgba(255,255,255,0.76);
    font-size: 14px;
    line-height: 1.7;
    max-width: 360px;
}

.brand-center {
    flex: 1;
    display: flex;
    align-items: center;
    padding-bottom: 60px;
}

/* RIGHT SIDE */
.form-panel {
    flex: 1;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    position: relative;
    overflow: hidden;

    background:
        radial-gradient(circle at top right, rgba(16,185,129,0.08), transparent 24%),
        radial-gradient(circle at bottom right, rgba(16,185,129,0.05), transparent 30%),
        radial-gradient(rgba(16,185,129,0.08) 1px, transparent 3px),
        linear-gradient(180deg, #f8fbf9 0%, #ffffff 100%);

    background-size:
        auto,
        auto,
        24px 24px,
        auto;

    background-position:
        top right,
        bottom right,
        0 0,
        center;
}

.form-panel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 90px;
    height: 100%;
    background: linear-gradient(
        90deg,
        rgba(11, 93, 53, 0.08),
        transparent
    );
    pointer-events: none;
}

.form-panel::after {
    content: '';
    position: absolute;
    bottom: 90px;
    right: 120px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(
        circle,
        rgba(16,185,129,0.08),
        transparent 70%
    );
}

.login-card {
    width: 100%;
    max-width: 470px;
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.85);
    border-radius: 28px;
    padding: 36px;
    box-shadow:
        0 24px 60px rgba(15, 23, 42, 0.08),
        0 8px 20px rgba(15, 23, 42, 0.04);
    animation: fadeUp .7s ease;
    position: relative;
    z-index: 2;
}

.login-title {
    text-align: center;
    font-size: 34px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.04em;
    margin-bottom: 10px;
}

.login-subtitle {
    text-align: center;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 26px;
}

.field-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
}

.input-wrap {
    position: relative;
    margin-bottom: 20px;
}

.input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
}

.input-field {
    width: 100%;
    height: 52px;
    border: 1.5px solid #dbe3ea;
    border-radius: 14px;
    padding: 0 16px 0 48px;
    font-size: 14px;
    background: #f8fafc;
    outline: none;
    transition: all .2s ease;
}

.input-field:focus {
    border-color: #0f8f52;
    background: white;
    box-shadow: 0 0 0 4px rgba(15,143,82,0.08);
}

.toggle-password {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    cursor: pointer;
    color: #94a3b8;
}

.forgot-link {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
}

.forgot-link a {
    text-decoration: none;
    color: #0f8f52;
    font-size: 13px;
    font-weight: 600;
}

.signin-btn {
    width: 100%;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #0f7a45, #10b981);
    color: white;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all .2s ease;
    box-shadow: 0 10px 24px rgba(16,185,129,0.16);
}

.signin-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(16,185,129,0.22);
}

.google-btn {
    width: 100%;
    height: 52px;
    border-radius: 14px;
    border: 1.5px solid #dbe3ea;
    background: white;
    font-size: 14px;
    font-weight: 600;
    margin-top: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #334155;
    transition: all .2s ease;
}

.google-btn:hover {
    transform: translateY(-1px);
    background: #f8fafc;
    border-color: #cbd5e1;
}
    .security-note {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
        line-height: 1.6;
    }

    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.35);
        border-top-color: white;
        border-radius: 50%;
        animation: spin .7s linear infinite;
    }

    @media (max-width: 900px) {
        .brand-panel {
            display: none;
        }

.form-panel::after {
    content: '';
    position: absolute;
    bottom: 80px;
    right: 100px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(
        circle,
        rgba(16,185,129,0.08),
        transparent 70%
    );
}

        .login-card {
            padding: 28px;
        }

        .login-title {
            font-size: 34px;
        }
    }
`}</style>
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
                <div className="error-box">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin}>
                <label className="field-label">Institutional Email</label>
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
        className="input-field"
        type={showPassword ? 'text' : 'password'}
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{ paddingRight: '50px' }}
    />

    <button
        type="button"
        className="toggle-password"
        onClick={() => setShowPassword(!showPassword)}
    >
        <span className="material-symbols-outlined">
            {showPassword ? 'visibility_off' : 'visibility'}
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

<button type="button" className="google-btn">
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
        </>
    );
}
