const express = require('express');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const app = express();
const port = 3000; // Change to your desired port

app.use(express.json());

const { MongoClient } = require('mongodb');
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'hafeez_db';
let db;

async function connectToDatabase() {
  try {
    const client = await MongoClient.connect(url, {
      useUnifiedTopology: true,
    });
    db = client.db(dbName);
    console.log('Connected to MongoDB successfully!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToDatabase();

const JWT_SECRET = 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTY5MTI5MDExNCwiaWF0IjoxNjkxMjkwMTE0fQ.cq_EqluX6zbFmV1szwuV5fwq2LGfhQ4Q2pTxKWyb210';
const JWT_EXPIRATION = '1h';

const signupValidation = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail({ gmail_remove_dots: true }),
  check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
];

const loginValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail({ gmail_remove_dots: true }),
  check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
];

app.post('/register', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ msg: 'This user is already in use!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser(name, email, hashedPassword);

    return res.status(201).json({ msg: 'The user has been registered with us!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: 'An error occurred while registering.' });
  }
});

app.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ msg: 'Email or password is incorrect!' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ msg: 'Email or password is incorrect!' });
    }

    const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    await updateLastLogin(user._id);

    return res.status(200).json({ msg: 'Logged in!', token, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: 'An error occurred while logging in.' });
  }
});

app.get('/get-user', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(422).json({
        message: 'Please provide the token'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);

    return res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: 'An error occurred while fetching user data.' });
  }
});

async function getUserByEmail(email) {
  return db.collection('users').findOne({ email: email });
}

async function createUser(name, email, password) {
  return db.collection('users').insertOne({ name, email, password });
}

async function updateLastLogin(userId) {
  return db.collection('users').updateOne({ _id: userId }, { $set: { last_login: new Date() } });
}

async function getUserById(userId) {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    return user;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
