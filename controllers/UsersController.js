const sha1 = require('sha1');
const mongodb = require('mongodb');
const Redis = require('../utils/redis');
const Mongo = require('../utils/db');

class UsersContoller {
  static async postNew(request, response) {
    const { email, password } = request.body;
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
    }
    if (await Mongo.users.findOne({ email })) {
      return response.status(400).json({ error: 'Already exist' });
    }
    const newUser = await Mongo.users.insertOne({
      email,
      password: sha1(password),
    });
    return response.status(201).json({ id: newUser.insertedId, email });
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const curUser = await Mongo.users.findOne({ _id: new mongodb.ObjectId(curUserToken) });
    return response.status(200).json({ id: curUser._id, email: curUser.email });
  }
}

module.exports = UsersContoller;
