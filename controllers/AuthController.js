const Redis = require('../utils/redis');
const Mongo = require('../utils/db');
const sha1 = require('sha1');
const { v4: uuid } = require('uuid');

class AuthController {
	static async getConnect(request, response) {
		const header = request.headers.authorization.split(' ')[1];
		const authorization = Buffer.from(header, 'base64').toString();
		const [email, password] = authorization.split(':');
		const curUser = await Mongo.users.findOne({
			email,
			password: sha1(password),
		});
		if (!curUser) {
			return response.status(401).json({error: 'Unauthorized'});
		}
		const token = uuid();
		await Redis.set(`auth_${token}`, curUser._id.toString(), 60*60*24);
		return response.status(200).json({token});
	}
	static async getDisconnect(request, response) {
		const token = request.header('X-Token');
		const authToken = `auth_${token}`;
		const curUser = await Redis.get(authToken);
		if (!curUser) {
			return response.status(401).json({error: 'Unauthorized'});
		}
		Redis.del(authToken);
		return response.status(204).send();
	}
};

module.exports = AuthController;
