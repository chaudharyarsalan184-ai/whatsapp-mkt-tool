import { forwardRef } from 'react';

const PhoneInput = forwardRef(function PhoneInput(
  { label, error, className = '', value, onChange, ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}
      <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-wa-green">
        <span className="flex items-center rounded-l-lg bg-gray-100 px-3 text-sm text-gray-600">
          +1
        </span>
        <input
          ref={ref}
          type="tel"
          className={`w-full rounded-r-lg border-0 px-3 py-2 text-sm outline-none ${className}`}
          placeholder="5551234567"
          value={value?.replace(/^\+1/, '') || ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            onChange?.({ target: { value: `+1${digits}` } });
          }}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
});

export default PhoneInput;
