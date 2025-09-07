const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initializeDatabase } = require('../config/production-database');

// Initialize models - get from shared instance
let User = null;
let dbInitialized = false;

const getUser = async () => {
  if (!dbInitialized) {
    try {
      const { models } = await initializeDatabase();
      User = models.User;
      dbInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database in auth controller:', error);
      throw error;
    }
  }
  return User;
};

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const signup = catchAsync(async (req, res, next) => {
  console.log('Signup request received:', req.body);
  const { email, password, firstName, lastName, name } = req.body;

  try {
    const UserModel = await getUser();
    if (!UserModel) {
      console.error('Database not initialized');
      return res.status(500).json({ 
        success: false,
        message: 'Database not initialized' 
      });
    }

    // Validate input - handle both name formats
    const first_name = firstName || (name ? name.split(' ')[0] : '');
    const last_name = lastName || (name ? name.split(' ').slice(1).join(' ') : '');
    
    console.log('Processed names:', { first_name, last_name });
    
    if (!email || !password || (!firstName && !name)) {
      console.error('Validation failed:', { email: !!email, password: !!password, firstName: !!firstName, name: !!name });
      return res.status(400).json({ 
        success: false,
        message: 'Email, password, and name are required' 
      });
    }

    // Check if user already exists
    console.log('Checking for existing user with email:', email);
    const existingUser = await UserModel.findOne({ where: { email } });
    if (existingUser) {
      console.log('User already exists');
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log('Creating new user...');
    const newUser = await UserModel.create({
      email,
      password_hash: hashedPassword,
      first_name: first_name,
      last_name: last_name
    });

    console.log('User created successfully:', newUser.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('JWT token generated');

    const response = {
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: `${newUser.first_name} ${newUser.last_name}`.trim(),
        first_name: newUser.first_name,
        last_name: newUser.last_name
      }
    };

    console.log('Sending response:', response);
    res.status(201).json(response);
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

const login = catchAsync(async (req, res, next) => {
  console.log('Login request received:', req.body);
  const { email, password } = req.body;

  try {
    const UserModel = await getUser();
    if (!UserModel) {
      console.error('Database not initialized');
      return res.status(500).json({ 
        success: false,
        message: 'Database not initialized' 
      });
    }

    // Check if email and password exist
    if (!email || !password) {
      console.error('Missing credentials:', { email: !!email, password: !!password });
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email and password!' 
      });
    }

    // Check if user exists && password is correct
    console.log('Looking for user with email:', email);
    const user = await UserModel.findOne({ where: { email } });
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ 
        success: false,
        message: 'Incorrect email or password' 
      });
    }

    console.log('User found, checking password...');
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log('Password does not match');
      return res.status(401).json({ 
        success: false,
        message: 'Incorrect email or password' 
      });
    }

    console.log('Password matches, generating token...');

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Login successful for user:', user.id);

    const response = {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name
      }
    };

    console.log('Sending login response:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

module.exports = {
  signup,
  login
};
