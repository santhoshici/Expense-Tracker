import React, { useContext, useState } from 'react'
import AuthLayout from '../../components/layouts/AuthLayout'
import { useNavigate, Link } from 'react-router-dom';
import Input from '../../components/Inputs/Input';
import { validateEmail } from '../../utils/helper';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { UserContext } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { LuSun, LuMoon } from 'react-icons/lu';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const { updateUser } = useContext(UserContext);
  const { theme, toggleTheme } = useTheme();

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (!/^.{6,}$/.test(password)) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setError("");

    //Login API Call

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email,
        password
      });
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        updateUser(user);
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.response && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }
    }
  }

  return (
    <AuthLayout>
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-foreground transition-colors z-50"
      >
        {theme === 'dark' ? <LuSun className="text-xl" /> : <LuMoon className="text-xl" />}
      </button>

      <div className="w-full">
        <h3 className="text-2xl font-bold text-foreground tracking-tight">
          Welcome Back
        </h3>
        <p className="text-sm text-muted-foreground mt-2 mb-8">
          Please enter login credentials to access your account
        </p>

        <form onSubmit={handleLogin}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email Address"
            placeholder="example314@gmail.com"
            type="text"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label="Password"
            placeholder="Min 6 characters"
            type="password"
          />

          {error && <p className='text-red-500 text-xs pb-2.5'>{error}</p>}

          <button type='submit' className='btn-primary'>
            LOGIN
          </button>

          <p className='text-[13px] text-muted-foreground mt-3'>
            Don't have an account?{" "}
            <Link className="font-semibold text-primary hover:underline transition-all" to="/signup">
              SignUp
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default Login;
