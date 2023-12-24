const mongodb = require('mongodb');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const Mongo = require('../utils/db');
const Redis = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    const allowedTypes = ['folder', 'file', 'image'];
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== 0) {
      const project = new mongodb.ObjectId(parentId);
      const file = await Mongo.files.findOne({ _id: project });

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    // The user ID should be added to the document saved in DB - as owner of a file
    let newFile;
    if (type === 'folder') {
      newFile = await Mongo.files.insertOne({
        userId: new mongodb.ObjectId(curUserToken),
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(FOLDER_PATH)) {
        fs.mkdirSync(FOLDER_PATH);
      }
      const localPath = `${FOLDER_PATH}/${uuid()}`;
      const dataDecoded = Buffer.from(req.body.data, 'base64').toString('utf-8');
      await fs.promises.writeFile(localPath, dataDecoded);
      newFile = await Mongo.files.insertOne({
        userId: new mongodb.ObjectId(curUserToken),
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });
    }
    return res.status(201).send({
      id: newFile.insertedId, userId: curUserToken, name, type, isPublic, parentId,
    });
  }

  static async getShow(request, response) {
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await Mongo.files.findOne({
      _id: new mongodb.ObjectId(request.params.id),
    });
    if (!file || curUserToken.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.json({ ...file });
  }

  static async getIndex(request, response) {
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { parentId, page = 0 } = request.query;
    let fileList;
    if (parentId) {
      fileList = await Mongo.files.aggregate([
        { $match: { parentId: new mongodb.ObjectId(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();
    } else {
      fileList = await Mongo.files.aggregate([
        { $match: { userId: new mongodb.ObjectId(new mongodb.ObjectId(curUserToken)) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();
    }
    return response.json(fileList.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })));
  }

  static async putPublish(request, response) {
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await Mongo.files.findOne({
      _id: new mongodb.ObjectId(request.params.id),
    });
    if (!file || curUserToken.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    file.isPublic = true;
    await Mongo.files.updateOne({ _id: file._id }, { $set: { isPublic: true } });
    return response.json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(request, response) {
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await Mongo.files.findOne({
      _id: new mongodb.ObjectId(request.params.id),
    });
    if (!file || curUserToken.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    file.isPublic = false;
    await Mongo.files.updateOne({ _id: file._id }, { $set: { isPublic: true } });
    return response.json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getFile(request, response) {
    const file = await Mongo.files.findOne({
      _id: new mongodb.ObjectId(request.params.id),
    });
    const token = request.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!file || (!file.isPublic && (!curUserToken
      || file.userId.toString() !== curUserToken.toString()))) {
      return response.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return response.status(400).json({ error: "A folder doesn't have content" });
    }
    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }
    const fileData = fs.readFileSync(file.localPath);
    return response.status(200).send(fileData);
  }
}

module.exports = FilesController;
