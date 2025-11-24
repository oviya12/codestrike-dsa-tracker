import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { updateSecurityQnA, getSecurityQuestion, resetPasswordViaSecurity } from '../services/dbServices';
import { Code2, Mail, Lock, Loader2, ArrowRight, CheckCircle2, Eye, EyeOff, ShieldQuestion, KeyRound, HelpCircle } from 'lucide-react';

type AuthView = 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_EMAIL' | 'FORGOT_VERIFY';

const Auth: React.FC = () => {
  const [view, setView] = useState<AuthView>('SIGN_IN');
  const [loading, setLoading] = useState(false);
  
  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [retrievedQuestion, setRetrievedQuestion] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  const clearErrors = () => {
    setErrors({});
    setMessage(null);
  };

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!email || !password) {
        setErrors({ general: 'Please fill in all fields.' });
        return;
    }
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    } catch (error: any) {
        setErrors({ general: 'Invalid email or password.' });
    } finally {
        setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const newErrors: { [key: string]: string } = {};

    if (!validateEmail(email)) newErrors.email = 'Invalid email address';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!securityQuestion.trim()) newErrors.question = 'Security question is required';
    if (!securityAnswer.trim()) newErrors.answer = 'Security answer is required';

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    setLoading(true);
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
            // Store Security Q&A
            const qnaError = await updateSecurityQnA(data.user.id, securityQuestion, securityAnswer);
            if (qnaError) console.error("Failed to save security question");
            
            if (!data.session) {
                setMessage("Account created! Please check your email to confirm.");
            }
        }
    } catch (error: any) {
        setErrors({ general: error.message });
    } finally {
        setLoading(false);
    }
  };

  // Step 1 of Forgot Password: Find User & Get Question
  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateEmail(email)) {
        setErrors({ email: 'Enter a valid email' });
        return;
    }
    setLoading(true);
    try {
        const question = await getSecurityQuestion(email);
        if (!question) {
            setErrors({ general: 'No account found with this email.' });
        } else {
            setRetrievedQuestion(question);
            setView('FORGOT_VERIFY');
        }
    } catch (error) {
        setErrors({ general: 'Error fetching account details.' });
    } finally {
        setLoading(false);
    }
  };

  // Step 2 of Forgot Password: Verify Answer & Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    if (!securityAnswer.trim()) {
        setErrors({ answer: 'Answer is required' });
        return;
    }
    if (newPassword.length < 6) {
        setErrors({ password: 'New password must be 6+ chars' });
        return;
    }

    setLoading(true);
    try {
        const success = await resetPasswordViaSecurity(email, securityAnswer, newPassword);
        if (success) {
            setMessage("Password reset successfully! You can now sign in.");
            setTimeout(() => {
                setView('SIGN_IN');
                setPassword('');
                setMessage(null);
            }, 2000);
        } else {
            setErrors({ general: 'Incorrect security answer.' });
        }
    } catch (error) {
        setErrors({ general: 'Failed to reset password.' });
    } finally {
        setLoading(false);
    }
  };

  const renderForm = () => {
    switch (view) {
        case 'SIGN_IN':
            return (
                <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                value={email} onChange={e => setEmail(e.target.value)} 
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:border-indigo-500 focus:outline-none"
                                placeholder="name@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-medium text-slate-400">Password</label>
                            <button type="button" onClick={() => setView('FORGOT_EMAIL')} className="text-xs text-indigo-400 hover:text-indigo-300">Forgot Password?</button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password} onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-slate-200 focus:border-indigo-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}
                    <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Sign In'}
                    </button>
                    <p className="text-center text-sm text-slate-500">
                        New here? <button type="button" onClick={() => setView('SIGN_UP')} className="text-indigo-400 font-medium">Create Account</button>
                    </p>
                </form>
            );

        case 'SIGN_UP':
            return (
                <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                            <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                        </div>
                        <div className="pt-2 border-t border-slate-800 mt-2">
                             <p className="text-xs text-indigo-400 mb-3 font-medium flex items-center gap-1"><ShieldQuestion size={12}/> Account Security Question</p>
                             <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Security Question</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. What is my first pet's name?"
                                        value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} 
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" 
                                    />
                                    {errors.question && <p className="text-xs text-red-400 mt-1">{errors.question}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Answer</label>
                                    <input 
                                        type="text" 
                                        placeholder="Your answer"
                                        value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} 
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" 
                                    />
                                    {errors.answer && <p className="text-xs text-red-400 mt-1">{errors.answer}</p>}
                                </div>
                             </div>
                        </div>
                    </div>
                    {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}
                    <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Sign Up'}
                    </button>
                    <p className="text-center text-sm text-slate-500">
                        Have an account? <button type="button" onClick={() => setView('SIGN_IN')} className="text-indigo-400 font-medium">Sign In</button>
                    </p>
                </form>
            );

        case 'FORGOT_EMAIL':
            return (
                <form onSubmit={handleFindAccount} className="space-y-4">
                    <p className="text-sm text-slate-400 mb-4">Enter your email to retrieve your security question.</p>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                        <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                    </div>
                    {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setView('SIGN_IN')} className="flex-1 py-3 border border-slate-700 text-slate-400 rounded-xl hover:text-white">Cancel</button>
                        <button disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Find Account'}
                        </button>
                    </div>
                </form>
            );

        case 'FORGOT_VERIFY':
            return (
                <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl mb-4">
                        <p className="text-xs text-indigo-300 font-bold uppercase mb-1">Security Question</p>
                        <p className="text-white font-medium">{retrievedQuestion}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Your Answer</label>
                        <input type="text" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                        {errors.answer && <p className="text-xs text-red-400 mt-1">{errors.answer}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-slate-200 focus:border-indigo-500 focus:outline-none" placeholder="Min 6 chars" />
                        {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                    </div>
                    {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setView('SIGN_IN')} className="flex-1 py-3 border border-slate-700 text-slate-400 rounded-xl hover:text-white">Cancel</button>
                        <button disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Reset Password'}
                        </button>
                    </div>
                </form>
            );
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#facc15] rounded-2xl flex items-center justify-center text-slate-900 shadow-xl shadow-yellow-500/20 mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Code2 size={32} strokeWidth={2.5} />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight mb-2">CodeStrike</h1>
                <p className="text-slate-400">
                    {view === 'SIGN_UP' ? 'Begin your consistency journey.' : view === 'SIGN_IN' ? 'Welcome back, Engineer.' : 'Account Recovery'}
                </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
                {message ? (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={24} />
                        </div>
                        <p className="text-white mb-6">{message}</p>
                        {view !== 'FORGOT_VERIFY' && (
                             <button onClick={() => setView('SIGN_IN')} className="text-indigo-400 hover:text-white font-medium">Back to Sign In</button>
                        )}
                    </div>
                ) : (
                    renderForm()
                )}
            </div>
        </div>
    </div>
  );
};

export default Auth;