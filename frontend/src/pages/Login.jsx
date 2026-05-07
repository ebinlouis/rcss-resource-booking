import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Swapped authService for useAuth

export default function Login() {
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [showPassword, setShow]   = useState(false);
    const [error, setError]         = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate();
    const { login } = useAuth(); // Extract login from global context

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            // Pass credentials as an object to match the AuthProvider logic
            const result = await login({ email, password });
            
            if (result.success) {
                navigate('/dashboard');
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
                @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
                @keyframes slideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
                @keyframes spin    { to { transform:rotate(360deg) } }

                .panel-left  { animation: fadeIn  .6s ease both; }
                .panel-right { animation: slideUp .55s cubic-bezier(.22,1,.36,1) .08s both; }

                .field-row { animation: slideUp .45s cubic-bezier(.22,1,.36,1) both; }
                .field-row:nth-child(1) { animation-delay: .18s }
                .field-row:nth-child(2) { animation-delay: .24s }
                .field-row:nth-child(3) { animation-delay: .30s }
                .field-row:nth-child(4) { animation-delay: .36s }
                .field-row:nth-child(5) { animation-delay: .42s }

                .grid-bg {
                    background-color: #003d23;
                    background-image:
                        linear-gradient(rgba(158,245,190,.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(158,245,190,.06) 1px, transparent 1px);
                    background-size: 32px 32px;
                }

                .accent-bar {
                    background: linear-gradient(90deg, #82d8a3, #9ef5be, #157347);
                    height: 3px;
                    width: 100%;
                }

                .rlab-input {
                    width: 100%;
                    height: 44px;
                    padding: 0 12px 0 40px;
                    background: #f6fbf4;
                    border: 1.5px solid #bec9bf;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    color: #181d19;
                    transition: border-color .18s, box-shadow .18s, background .18s;
                    outline: none;
                    box-sizing: border-box;
                }
                .rlab-input::placeholder { color: #6f7a71; }
                .rlab-input:focus {
                    border-color: #157347;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(21,115,71,.10);
                }

                .btn-signin {
                    width: 100%;
                    height: 44px;
                    background: #157347;
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: .01em;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: background .18s, box-shadow .18s, transform .18s;
                    box-shadow: 0 1px 3px rgba(0,89,52,.20), 0 4px 12px rgba(0,89,52,.14);
                }
                .btn-signin:not(:disabled):hover {
                    background: #005934;
                    box-shadow: 0 2px 6px rgba(0,89,52,.24), 0 8px 20px rgba(0,89,52,.18);
                    transform: translateY(-1px);
                }
                .btn-signin:not(:disabled):active { transform: translateY(0); }
                .btn-signin:disabled { opacity: .6; cursor: not-allowed; }

                .btn-google {
                    width: 100%;
                    height: 44px;
                    background: #ffffff;
                    color: #181d19;
                    border: 1.5px solid #bec9bf;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    transition: border-color .18s, box-shadow .18s, transform .18s;
                }
                .btn-google:hover {
                    border-color: #6f7a71;
                    box-shadow: 0 2px 8px rgba(0,0,0,.06);
                    transform: translateY(-1px);
                }

                .spinner {
                    width: 17px; height: 17px;
                    border: 2px solid rgba(255,255,255,.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin .65s linear infinite;
                }

                .badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 500;
                    color: rgba(158,245,190,.65);
                    letter-spacing: .02em;
                }

                .divider-line {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #6f7a71;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: .08em;
                    text-transform: uppercase;
                }
                .divider-line::before,
                .divider-line::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #dfe4dd;
                }

                .eye-btn {
                    position: absolute;
                    right: 11px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #6f7a71;
                    padding: 0;
                    display: flex;
                    transition: color .15s;
                }
                .eye-btn:hover { color: #181d19; }

                .error-bar {
                    background: #ffdad6;
                    border: 1px solid #f4b8b4;
                    border-radius: 8px;
                    padding: 10px 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #93000a;
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 20px;
                }

                .footer-link {
                    font-size: 12px;
                    color: #6f7a71;
                    font-weight: 500;
                    text-decoration: none;
                    transition: color .15s;
                }
                .footer-link:hover { color: #157347; }

                /* Responsive: collapse to single column on narrow viewports */
                @media (max-width: 768px) {
                    .panel-left { display: none !important; }
                    .panel-right { padding: 40px 24px !important; }
                }
            `}</style>

            <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Geist, sans-serif' }}>

                {/* ── LEFT: Brand Panel ── */}
                <div className="panel-left grid-bg"
                    style={{
                        width: '42%',
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }}>

                    <div className="accent-bar" />

                    {/* Ambient glow */}
                    <div style={{
                        position:'absolute', top:'10%', left:'-15%',
                        width:'80%', height:'55%',
                        background:'radial-gradient(circle, rgba(21,115,71,.3) 0%, transparent 70%)',
                        filter:'blur(56px)',
                        pointerEvents:'none',
                    }}/>
                    <div style={{
                        position:'absolute', bottom:'5%', right:'-5%',
                        width:'50%', height:'40%',
                        background:'radial-gradient(circle, rgba(0,89,52,.25) 0%, transparent 70%)',
                        filter:'blur(48px)',
                        pointerEvents:'none',
                    }}/>

                    <div style={{
                        flex:1,
                        display:'flex',
                        flexDirection:'column',
                        justifyContent:'space-between',
                        padding:'44px 44px',
                        position:'relative',
                        zIndex:1,
                    }}>

                        {/* Wordmark */}
                        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                            <div style={{
                                width:34, height:34,
                                background:'linear-gradient(135deg, #82d8a3 0%, #157347 100%)',
                                borderRadius:9,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                boxShadow:'0 2px 10px rgba(21,115,71,.45)',
                            }}>
                                <span style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'-.03em' }}>R</span>
                            </div>
                            <span style={{ color:'#9ef5be', fontWeight:700, fontSize:15, letterSpacing:'-.01em' }}>
                                Resource Booking
                            </span>
                        </div>

                        {/* Hero */}
                        <div>
                            <div style={{
                                display:'inline-flex', alignItems:'center', gap:7,
                                background:'rgba(158,245,190,.08)',
                                border:'1px solid rgba(158,245,190,.18)',
                                borderRadius:100,
                                padding:'4px 12px',
                                marginBottom:22,
                            }}>
                                <span style={{
                                    width:6, height:6, borderRadius:'50%',
                                    background:'#82d8a3',
                                    boxShadow:'0 0 7px #82d8a3',
                                }}/>
                                <span style={{ color:'#82d8a3', fontSize:11, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' }}>
                                    RCSS
                                </span>
                            </div>

                            <h2 style={{
                                color:'#ffffff',
                                fontSize:30,
                                fontWeight:800,
                                lineHeight:1.22,
                                letterSpacing:'-.03em',
                                margin:'0 0 16px',
                            }}>
                                Reserve. Schedule.<br />
                                <span style={{ color:'#82d8a3' }}>Get things done.</span>
                            </h2>
                            <p style={{
                                color:'rgba(158,245,190,.5)',
                                fontSize:14,
                                lineHeight:1.7,
                                margin:0,
                                maxWidth:270,
                            }}>
                                A unified platform for managing lab time, equipment reservations, and team schedules across your institution.
                            </p>
                        </div>

                        {/* Trust signals */}
                        <div>
                            <div style={{ height:1, background:'rgba(158,245,190,.1)', marginBottom:20 }}/>
                            {[
                                { icon:'verified_user',        label:'SSO & institutional auth' },
                                { icon:'schedule',             label:'Real-time availability' },
                                { icon:'admin_panel_settings', label:'Role-based access control' },
                            ].map(({ icon, label }) => (
                                <div key={icon} className="badge" style={{ marginBottom:13 }}>
                                    <span className="material-symbols-outlined"
                                        style={{ fontSize:15, color:'rgba(130,216,163,.65)' }}>
                                        {icon}
                                    </span>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Form Panel ── */}
                <div className="panel-right"
                    style={{
                        flex:1,
                        minHeight:'100vh',
                        background:'#ffffff',
                        display:'flex',
                        flexDirection:'column',
                        alignItems:'center',
                        justifyContent:'center',
                        padding:'48px 40px',
                        position:'relative',
                    }}>

                    {/* Top-right nav */}
                    <div style={{
                        position:'absolute', top:28, right:32,
                        display:'flex', alignItems:'center', gap:6,
                    }}>
                        <span style={{ fontSize:13, color:'#6f7a71' }}>Need help?</span>
                        <a href="#" style={{ fontSize:13, fontWeight:600, color:'#157347', textDecoration:'none' }}>
                            Campus Support →
                        </a>
                    </div>

                    {/* Form content */}
                    <div style={{ width:'100%', maxWidth:380 }}>

                        {/* Heading */}
                        <div className="field-row" style={{ marginBottom:32 }}>
                            <h1 style={{
                                fontSize:26, fontWeight:800,
                                letterSpacing:'-.03em', color:'#181d19',
                                margin:'0 0 8px',
                            }}>
                                Welcome back
                            </h1>
                            <p style={{ fontSize:14, color:'#6f7a71', margin:0, lineHeight:1.6 }}>
                                Sign in to your RLAB account to continue.
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="error-bar">
                                <span className="material-symbols-outlined" style={{ fontSize:17, flexShrink:0 }}>
                                    error_outline
                                </span>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:0 }}>

                            {/* Email */}
                            <div className="field-row" style={{ marginBottom:16 }}>
                                <label style={{
                                    display:'block', fontSize:12, fontWeight:600,
                                    color:'#3f4941', letterSpacing:'.02em', marginBottom:6,
                                }}>
                                    Institutional email
                                </label>
                                <div style={{ position:'relative' }}>
                                    <span className="material-symbols-outlined" style={{
                                        position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
                                        fontSize:18, color:'#6f7a71', pointerEvents:'none', userSelect:'none',
                                    }}>mail</span>
                                    <input
                                        className="rlab-input"
                                        id="email" type="email"
                                        placeholder="name@institution.edu"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="field-row" style={{ marginBottom:24 }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                    <label style={{ fontSize:12, fontWeight:600, color:'#3f4941', letterSpacing:'.02em' }}>
                                        Password
                                    </label>
                                    <a href="#" style={{ fontSize:12, fontWeight:600, color:'#157347', textDecoration:'none' }}>
                                        Forgot password?
                                    </a>
                                </div>
                                <div style={{ position:'relative' }}>
                                    <span className="material-symbols-outlined" style={{
                                        position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
                                        fontSize:18, color:'#6f7a71', pointerEvents:'none', userSelect:'none',
                                    }}>lock</span>
                                    <input
                                        className="rlab-input"
                                        style={{ paddingRight:40 }}
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                    />
                                    <button type="button" className="eye-btn"
                                        onClick={() => setShow(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        <span className="material-symbols-outlined" style={{ fontSize:18 }}>
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="field-row" style={{ marginBottom:14 }}>
                                <button type="submit" className="btn-signin" disabled={isLoading}>
                                    {isLoading
                                        ? <><div className="spinner"/><span>Signing in…</span></>
                                        : <><span>Sign in</span>
                                           <span className="material-symbols-outlined" style={{ fontSize:18 }}>arrow_forward</span></>
                                    }
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="field-row divider-line" style={{ marginBottom:14 }}>or</div>

                            {/* Google */}
                            <div className="field-row">
                                <button type="button" className="btn-google">
                                    <svg width="17" height="17" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continue with Google
                                </button>
                            </div>
                        </form>

                        {/* Security note */}
                        <div className="field-row" style={{
                            marginTop:32, paddingTop:24,
                            borderTop:'1px solid #dfe4dd',
                            display:'flex', alignItems:'flex-start', gap:8,
                        }}>
                            <span className="material-symbols-outlined"
                                style={{ fontSize:15, color:'#6f7a71', marginTop:1, flexShrink:0 }}>
                                shield
                            </span>
                            <span style={{ fontSize:12, color:'#6f7a71', lineHeight:1.6 }}>
                                Protected by institutional SSO. Your credentials are never stored directly.
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        position:'absolute', bottom:24,
                        display:'flex', gap:24, alignItems:'center',
                    }}>
                        {['Privacy Policy','Terms of Service'].map(l => (
                            <a key={l} href="#" className="footer-link">{l}</a>
                        ))}
                        <span style={{ fontSize:12, color:'#bec9bf' }}>© 2026 RLAB</span>
                    </div>
                </div>
            </div>
        </>
    );
}