import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user, loading } = useAuth();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || '/';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wa-sidebar to-gray-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-wa-green text-2xl font-bold text-white">
            W
          </div>
          <h1 className="text-xl font-bold text-gray-900">Travel WhatsApp Marketing</h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-wa-green py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Need an account?{' '}
          <Link to="/register" className="font-medium text-wa-green">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
