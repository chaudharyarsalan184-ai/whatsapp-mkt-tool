import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register: registerUser, user, loading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', email: '', password: '' } });

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data) => {
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Account created');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wa-sidebar to-gray-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-xl font-bold text-gray-900">Create admin account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              {...register('name', { required: true })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">Required</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              {...register('email', { required: true })}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">Required</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              {...register('password', { required: true, minLength: 6 })}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">Min 6 characters</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-wa-green py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-wa-green">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
