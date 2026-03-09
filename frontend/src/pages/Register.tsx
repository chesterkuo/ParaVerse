import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, password, name);
      navigate("/");
    } catch {
      setError("Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-4">
        <h1 className="text-2xl font-bold text-navy">Register</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input id="reg-name" type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded" required />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="reg-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded" required />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input id="reg-password" type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded" required minLength={8} />
        </div>
        <button type="submit" className="w-full bg-navy text-white py-2 rounded hover:bg-navy/90 cursor-pointer">Register</button>
        <p className="text-sm text-center">
          Have an account? <Link to="/login" className="text-violet">Login</Link>
        </p>
      </form>
    </div>
  );
}
